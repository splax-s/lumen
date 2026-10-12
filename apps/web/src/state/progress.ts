import { DEPTHS, type AttemptRecord, type Depth } from '@lumen/engine';

/**
 * The learner's progress, kept on the device first. It works with no account and with no
 * storage at all (private browsing), and it is synced to the API when someone is signed in.
 */

export type Streak = { current: number; longest: number; lastDay: string | null; restDaysLeft: number };

export type Progress = {
  version: 1;
  depth: Depth;
  /** Read Lumi's lines aloud automatically at Play depth. */
  narrate: boolean;
  /** Oldest first; the most recently finished lesson is last. */
  done: { lessonId: string; at: number }[];
  cards: { lessonId: string; at: number }[];
  streak: Streak;
  /** Finished attempts not yet accepted by the API. */
  pendingAttempts: AttemptRecord[];
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const STORAGE_KEY = 'lumen.progress';
/** A streak survives this many missed days before it resets. */
export const REST_DAYS = 2;
const MAX_PENDING = 200;

export function dayKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days from one day key to a later one. */
export function daysBetween(from: string, to: string): number {
  const parse = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function emptyProgress(): Progress {
  return {
    version: 1,
    depth: 'play',
    narrate: true,
    done: [],
    cards: [],
    streak: { current: 0, longest: 0, lastDay: null, restDaysLeft: REST_DAYS },
    pendingAttempts: [],
  };
}

export function nextStreak(streak: Streak, today: string): Streak {
  if (streak.lastDay === today) return streak;
  if (streak.lastDay === null || streak.current === 0) {
    return { current: 1, longest: Math.max(streak.longest, 1), lastDay: today, restDaysLeft: REST_DAYS };
  }
  const missed = daysBetween(streak.lastDay, today) - 1;
  if (missed < 0) return streak; // the clock went backwards; leave the streak alone
  if (missed <= streak.restDaysLeft) {
    const current = streak.current + 1;
    return {
      current,
      longest: Math.max(streak.longest, current),
      lastDay: today,
      restDaysLeft: streak.restDaysLeft - missed,
    };
  }
  return { current: 1, longest: streak.longest, lastDay: today, restDaysLeft: REST_DAYS };
}

function isEntryList(value: unknown): value is { lessonId: string; at: number }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof (entry as { lessonId?: unknown }).lessonId === 'string' &&
        typeof (entry as { at?: unknown }).at === 'number',
    )
  );
}

/** Returns stored progress if it is usable, otherwise a fresh start. Never throws. */
export function parseProgress(raw: string | null): Progress {
  const fresh = emptyProgress();
  if (!raw) return fresh;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fresh;
  }
  if (value === null || typeof value !== 'object') return fresh;
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !isEntryList(data.done) || !isEntryList(data.cards)) return fresh;
  const streak = data.streak as Partial<Streak> | undefined;
  return {
    version: 1,
    depth: DEPTHS.includes(data.depth as Depth) ? (data.depth as Depth) : 'play',
    narrate: typeof data.narrate === 'boolean' ? data.narrate : true,
    done: data.done,
    cards: data.cards,
    streak:
      streak &&
      typeof streak.current === 'number' &&
      typeof streak.longest === 'number' &&
      typeof streak.restDaysLeft === 'number' &&
      (streak.lastDay === null || typeof streak.lastDay === 'string')
        ? {
            current: streak.current,
            longest: streak.longest,
            lastDay: streak.lastDay ?? null,
            restDaysLeft: streak.restDaysLeft,
          }
        : fresh.streak,
    pendingAttempts: Array.isArray(data.pendingAttempts)
      ? (data.pendingAttempts.filter(
          (a) => a !== null && typeof a === 'object' && typeof (a as AttemptRecord).id === 'string',
        ) as AttemptRecord[])
      : [],
  };
}

export type ProgressStore = {
  get(): Progress;
  subscribe(listener: () => void): () => void;
  setDepth(depth: Depth): void;
  setNarrate(on: boolean): void;
  completeLesson(attempt: AttemptRecord): void;
  markSent(attemptIds: string[]): void;
  /** Replace local progress with a merged view from the server, keeping unsent attempts. */
  replace(next: Pick<Progress, 'done' | 'cards' | 'streak'>): void;
  reset(): void;
};

export function createProgressStore(options: {
  storage: StorageLike | null;
  now?: () => number;
  key?: string;
}): ProgressStore {
  const now = options.now ?? (() => Date.now());
  const key = options.key ?? STORAGE_KEY;
  const listeners = new Set<() => void>();

  let state: Progress;
  try {
    state = parseProgress(options.storage?.getItem(key) ?? null);
  } catch {
    state = emptyProgress();
  }

  const commit = (next: Progress) => {
    state = next;
    try {
      options.storage?.setItem(key, JSON.stringify(next));
    } catch {
      // Storage is full or blocked. Progress stays in memory for this visit.
    }
    for (const listener of [...listeners]) listener();
  };

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setDepth(depth) {
      if (depth !== state.depth) commit({ ...state, depth });
    },
    setNarrate(on) {
      if (on !== state.narrate) commit({ ...state, narrate: on });
    },
    completeLesson(attempt) {
      const at = now();
      const firstTime = !state.done.some((d) => d.lessonId === attempt.lessonId);
      const queued = state.pendingAttempts.some((a) => a.id === attempt.id);
      commit({
        ...state,
        done: [...state.done.filter((d) => d.lessonId !== attempt.lessonId), { lessonId: attempt.lessonId, at }],
        cards: firstTime ? [...state.cards, { lessonId: attempt.lessonId, at }] : state.cards,
        streak: nextStreak(state.streak, dayKey(at)),
        pendingAttempts: queued ? state.pendingAttempts : [...state.pendingAttempts, attempt].slice(-MAX_PENDING),
      });
    },
    markSent(attemptIds) {
      const sent = new Set(attemptIds);
      commit({ ...state, pendingAttempts: state.pendingAttempts.filter((a) => !sent.has(a.id)) });
    },
    replace(next) {
      commit({ ...state, done: next.done, cards: next.cards, streak: next.streak });
    },
    reset() {
      commit({ ...emptyProgress(), depth: state.depth, narrate: state.narrate });
    },
  };
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The app's single progress store. */
export const progress: ProgressStore = createProgressStore({ storage: browserStorage() });
