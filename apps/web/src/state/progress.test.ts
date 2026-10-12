import type { AttemptRecord } from '@lumen/engine';
import { createProgressStore, dayKey, type StorageLike } from './progress';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function attempt(lessonId: string, id = `a-${lessonId}`): AttemptRecord {
  return {
    id,
    lessonId,
    depth: 'play',
    startedAt: 0,
    finishedAt: 1,
    steps: [],
    hintsUsed: 0,
    reviewConcepts: [],
  };
}

const DAY = 24 * 60 * 60 * 1000;
const start = new Date(2026, 9, 12, 10, 0, 0).getTime();

function setup(storage: StorageLike | null = memoryStorage()) {
  let now = start;
  const store = createProgressStore({ storage, now: () => now });
  return {
    store,
    storage,
    at(days: number) {
      now = start + days * DAY;
    },
  };
}

describe('progress store', () => {
  it('starts empty at Play depth', () => {
    const { store } = setup();
    expect(store.get()).toMatchObject({ depth: 'play', done: [], cards: [], pendingAttempts: [] });
    expect(store.get().streak.current).toBe(0);
  });

  it('records a finished lesson once, however often it is finished', () => {
    const { store } = setup();
    store.completeLesson(attempt('chem.ice-floats', 'a1'));
    store.completeLesson(attempt('chem.ice-floats', 'a2'));
    expect(store.get().done.map((d) => d.lessonId)).toEqual(['chem.ice-floats']);
    expect(store.get().cards).toHaveLength(1);
  });

  it('does not queue the same attempt twice', () => {
    const { store } = setup();
    store.completeLesson(attempt('chem.ice-floats', 'a1'));
    store.completeLesson(attempt('chem.ice-floats', 'a1'));
    expect(store.get().pendingAttempts).toHaveLength(1);
  });

  it('keeps the most recently finished lesson last', () => {
    const { store } = setup();
    store.completeLesson(attempt('chem.ice-floats'));
    store.completeLesson(attempt('phys.swing'));
    expect(store.get().done.map((d) => d.lessonId)).toEqual(['chem.ice-floats', 'phys.swing']);
  });

  it('persists and reloads', () => {
    const storage = memoryStorage();
    const first = setup(storage);
    first.store.setDepth('deep');
    first.store.completeLesson(attempt('chem.ice-floats'));
    const second = setup(storage);
    expect(second.store.get().depth).toBe('deep');
    expect(second.store.get().done).toHaveLength(1);
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const { store } = setup();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.setDepth('explain');
    off();
    store.setDepth('deep');
    expect(calls).toBe(1);
  });

  it('removes sent attempts from the queue', () => {
    const { store } = setup();
    store.completeLesson(attempt('chem.ice-floats', 'a1'));
    store.completeLesson(attempt('phys.swing', 'a2'));
    store.markSent(['a1']);
    expect(store.get().pendingAttempts.map((a) => a.id)).toEqual(['a2']);
  });

  it('resets everything', () => {
    const { store } = setup();
    store.completeLesson(attempt('chem.ice-floats'));
    store.reset();
    expect(store.get().done).toHaveLength(0);
    expect(store.get().streak.current).toBe(0);
  });

  describe('streak', () => {
    it('starts at one on the first finished lesson and holds on the same day', () => {
      const { store } = setup();
      store.completeLesson(attempt('a.one'));
      store.completeLesson(attempt('a.two'));
      expect(store.get().streak).toMatchObject({ current: 1, longest: 1, lastDay: dayKey(start) });
    });

    it('grows on consecutive days', () => {
      const { store, at } = setup();
      store.completeLesson(attempt('a.one'));
      at(1);
      store.completeLesson(attempt('a.two'));
      at(2);
      store.completeLesson(attempt('a.three'));
      expect(store.get().streak).toMatchObject({ current: 3, longest: 3 });
    });

    it('spends a rest day to cover one missed day', () => {
      const { store, at } = setup();
      store.completeLesson(attempt('a.one'));
      at(2);
      store.completeLesson(attempt('a.two'));
      expect(store.get().streak.current).toBe(2);
      expect(store.get().streak.restDaysLeft).toBe(1);
    });

    it('resets after a longer gap but remembers the longest', () => {
      const { store, at } = setup();
      store.completeLesson(attempt('a.one'));
      at(1);
      store.completeLesson(attempt('a.two'));
      at(6);
      store.completeLesson(attempt('a.three'));
      expect(store.get().streak).toMatchObject({ current: 1, longest: 2 });
    });

    it('resets once the rest days run out, and a new streak gets fresh rest days', () => {
      const { store, at } = setup();
      store.completeLesson(attempt('a.one'));
      at(2);
      store.completeLesson(attempt('a.two'));
      at(4);
      store.completeLesson(attempt('a.three'));
      at(6);
      expect(store.get().streak).toMatchObject({ current: 3, restDaysLeft: 0 });
      store.completeLesson(attempt('a.four'));
      expect(store.get().streak).toMatchObject({ current: 1, longest: 3, restDaysLeft: 2 });
    });
  });

  describe('when storage misbehaves', () => {
    it('works in memory when there is no storage at all', () => {
      const { store } = setup(null);
      store.completeLesson(attempt('chem.ice-floats'));
      expect(store.get().done).toHaveLength(1);
    });

    it('works in memory when writing throws', () => {
      const storage = memoryStorage();
      storage.setItem = () => {
        throw new Error('QuotaExceededError');
      };
      const { store } = setup(storage);
      expect(() => store.completeLesson(attempt('chem.ice-floats'))).not.toThrow();
      expect(store.get().done).toHaveLength(1);
    });

    it('works when reading throws', () => {
      const storage = memoryStorage();
      storage.getItem = () => {
        throw new Error('SecurityError');
      };
      expect(setup(storage).store.get().done).toEqual([]);
    });

    it.each([
      ['not json', '{oops'],
      ['the wrong shape', '{"version":1,"done":"yes"}'],
      ['a future version', '{"version":99,"done":[]}'],
      ['null', 'null'],
      ['entries of the wrong type', '{"version":1,"depth":"play","done":[{"lessonId":7}],"cards":[]}'],
    ])('starts empty when the stored value is %s', (_name, raw) => {
      const { store } = setup(memoryStorage({ 'lumen.progress': raw }));
      expect(store.get().done).toEqual([]);
      expect(store.get().depth).toBe('play');
    });
  });
});
