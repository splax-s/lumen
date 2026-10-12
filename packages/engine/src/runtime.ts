import { evaluate, parseCondition, type Condition } from './condition';
import { DEPTHS, resolveText, type Depth, type DepthText, type Mood } from './depth';
import { EventBus, type SimEvent } from './events';
import type { Lesson, LumiLine, SimSpec, Step, ThenStage } from './schema';
import type { SimState } from './sim/types';

export type RuntimeState = {
  stepIndex: number;
  stepCount: number;
  step: Step;
  /** Continue is enabled. */
  ready: boolean;
  /** 0 none, 1 nudge, 2 clue, 3 demo, 4 answer shown. */
  hintLevel: 0 | 1 | 2 | 3 | 4;
  /** Predict choice to glow at clue level. */
  highlight: string | null;
  /** Worked example to run at demo level. */
  demo: SimSpec | null;
  /** Predict: the right answer has been picked or shown. */
  solved: boolean;
  wrongChoices: string[];
  /** Challenge: which part is active. */
  stage: 'sort' | 'then' | null;
  sorted: string[];
  toggleOn: boolean;
  lumi: { mood: Mood; text: DepthText };
  depth: Depth;
  finished: boolean;
};

export type AttemptRecord = {
  /** Client-generated, so a retried upload cannot create a second attempt. */
  id: string;
  lessonId: string;
  depth: Depth;
  startedAt: number;
  finishedAt: number | null;
  steps: { type: string; wrong: number; hintLevel: number; ms: number }[];
  hintsUsed: number;
  reviewConcepts: string[];
};

type StepMemory = {
  ready: boolean;
  wrong: number;
  hintLevel: 0 | 1 | 2 | 3 | 4;
  highlight: string | null;
  demo: SimSpec | null;
  solved: boolean;
  wrongChoices: string[];
  sorted: string[];
  toggleOn: boolean;
  toggleUsed: boolean;
  ms: number;
};

export type RuntimeOptions = {
  depth: Depth;
  now?: () => number;
  newId?: () => string;
};

/** Two activations of Continue closer together than this count as one. */
const DOUBLE_ACTIVATION_MS = 300;

function defaultId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function lineText(line: LumiLine): DepthText {
  return { play: line.play, explain: line.explain, deep: line.deep };
}

/** Applies a change to each depth's wording, keeping the fallback order intact. */
function mapDepths(text: DepthText, change: (value: string, depth: Depth) => string): DepthText {
  const out: { play?: string; explain?: string; deep?: string } = {};
  for (const depth of DEPTHS) out[depth] = change(resolveText(text, depth), depth);
  return out;
}

/**
 * Runs one lesson: which step is showing, whether the learner may continue, what Lumi is saying,
 * and how far up the hint ladder they are. It knows nothing about the screen.
 */
export class LessonRuntime {
  readonly bus: EventBus;
  private readonly lesson: Lesson;
  private readonly now: () => number;
  private readonly memory: StepMemory[];
  private readonly conditions: (Condition | null)[];
  private readonly thenCondition: Condition | null;
  private readonly listeners = new Set<() => void>();
  private readonly id: string;
  private readonly startedAt: number;
  private finishedAt: number | null = null;
  private readonly reviewConcepts = new Set<string>();
  private simState: SimState = {};
  private index = 0;
  private depth: Depth;
  private lumi: { mood: Mood; text: DepthText } = { mood: 'happy', text: '' };
  private enteredAt: number;
  private lastAdvance = -Infinity;
  private snapshot: RuntimeState | null = null;

  constructor(lesson: Lesson, options: RuntimeOptions) {
    this.lesson = lesson;
    this.depth = options.depth;
    this.now = options.now ?? (() => Date.now());
    this.id = (options.newId ?? defaultId)();
    this.bus = new EventBus(this.now);
    this.startedAt = this.now();
    this.enteredAt = this.startedAt;
    this.memory = lesson.steps.map(() => ({
      ready: false,
      wrong: 0,
      hintLevel: 0,
      highlight: null,
      demo: null,
      solved: false,
      wrongChoices: [],
      sorted: [],
      toggleOn: false,
      toggleUsed: false,
      ms: 0,
    }));
    this.conditions = lesson.steps.map((step) =>
      'done_when' in step && step.done_when !== undefined ? parseCondition(step.done_when) : null,
    );
    const challenge = lesson.steps.find((s) => s.type === 'challenge');
    const thenSource = challenge?.type === 'challenge' ? challenge.then?.done_when : undefined;
    this.thenCondition = thenSource !== undefined ? parseCondition(thenSource) : null;
    this.bus.on((event) => this.onEvent(event));
    this.enter();
  }

  getState(): RuntimeState {
    if (this.snapshot) return this.snapshot;
    const step = this.step;
    const memory = this.mem;
    this.snapshot = {
      stepIndex: this.index,
      stepCount: this.lesson.steps.length,
      step,
      ready: memory.ready && !this.finished,
      hintLevel: memory.hintLevel,
      highlight: memory.highlight,
      demo: memory.demo,
      solved: memory.solved,
      wrongChoices: [...memory.wrongChoices],
      stage: step.type === 'challenge' ? this.challengeStage() : null,
      sorted: [...memory.sorted],
      toggleOn: memory.toggleOn,
      lumi: this.lumi,
      depth: this.depth,
      finished: this.finished,
    };
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setDepth(depth: Depth): void {
    if (depth === this.depth) return;
    this.depth = depth;
    this.changed();
  }

  /** Simulations report their state here so `done_when` can read it. */
  setSimState(state: SimState): void {
    this.simState = { ...this.simState, ...state };
    if (this.checkDone()) this.changed();
  }

  say(line: LumiLine): void {
    this.lumi = { mood: line.mood ?? 'happy', text: lineText(line) };
    this.changed();
  }

  answerPredict(choiceId: string): 'correct' | 'not_quite' {
    const step = this.step;
    const memory = this.mem;
    if (step.type !== 'predict' || memory.solved) return 'correct';
    if (choiceId === step.answer) {
      memory.solved = true;
      memory.ready = true;
      memory.highlight = null;
      this.say({ mood: 'proud', ...step.correct });
      return 'correct';
    }
    if (!memory.wrongChoices.includes(choiceId)) {
      memory.wrongChoices.push(choiceId);
      memory.wrong += 1;
      this.climb();
    }
    return 'not_quite';
  }

  /** Moves one rung up the hint ladder without the learner having to guess. */
  requestHint(): void {
    const step = this.step;
    if (step.type !== 'predict' || this.mem.solved) return;
    this.climb();
  }

  answerSort(itemId: string, binId: string): 'correct' | 'not_quite' {
    const step = this.step;
    const memory = this.mem;
    if (step.type !== 'challenge' || !step.sort) return 'correct';
    const item = step.sort.items.find((candidate) => candidate.id === itemId);
    if (!item || memory.sorted.includes(itemId)) return 'correct';
    if (item.bin !== binId) {
      memory.wrong += 1;
      const template = step.sort.not_quite;
      const text = mapDepths(lineText(template), (value, depth) => {
        const name = resolveText(item.name, depth);
        return value
          .replaceAll('{name}', name.toLowerCase())
          .replaceAll('{Name}', name)
          .replaceAll('{detail}', item.detail ?? '');
      });
      this.lumi = { mood: template.mood ?? 'thinking', text };
      this.changed();
      return 'not_quite';
    }
    memory.sorted.push(itemId);
    if (memory.sorted.length === step.sort.items.length) {
      this.lumi = { mood: step.sort.done.mood ?? 'proud', text: lineText(step.sort.done) };
      if (!step.then) memory.ready = true;
      else this.bus.clear();
    }
    this.changed();
    return 'correct';
  }

  /** Flips the toggle on the current step (or on a challenge's follow-up). */
  setToggle(on: boolean): void {
    const toggle = this.activeStage()?.toggle;
    if (!toggle) return;
    const memory = this.mem;
    memory.toggleOn = on;
    memory.toggleUsed = true;
    const side = on ? toggle.on : toggle.off;
    if (side.lumi) this.lumi = { mood: side.lumi.mood ?? 'happy', text: lineText(side.lumi) };
    if (this.step.type === 'challenge' && this.thenCondition === null) memory.ready = true;
    this.checkDone();
    this.changed();
  }

  next(): boolean {
    const now = this.now();
    if (this.finished || !this.mem.ready) return false;
    if (now - this.lastAdvance < DOUBLE_ACTIVATION_MS) return false;
    this.lastAdvance = now;
    this.leave();
    if (this.index === this.lesson.steps.length - 1) {
      this.finishedAt = now;
      this.changed();
      return true;
    }
    this.index += 1;
    this.enter();
    return true;
  }

  back(): void {
    if (this.finished || this.index === 0) return;
    this.leave();
    this.index -= 1;
    this.enter();
  }

  /** Development and test helper: go straight to a step. */
  jumpTo(index: number): void {
    if (index < 0 || index >= this.lesson.steps.length) return;
    this.leave();
    this.index = index;
    this.enter();
  }

  attempt(): AttemptRecord {
    const steps = this.lesson.steps.map((step, i) => {
      const memory = this.memory[i]!;
      const live = i === this.index && !this.finished ? this.now() - this.enteredAt : 0;
      return {
        type: step.type,
        wrong: memory.wrong,
        hintLevel: memory.hintLevel,
        ms: memory.ms + live,
      };
    });
    return {
      id: this.id,
      lessonId: this.lesson.id,
      depth: this.depth,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      steps,
      hintsUsed: steps.reduce((sum, s) => sum + s.hintLevel, 0),
      reviewConcepts: [...this.reviewConcepts],
    };
  }

  private get finished(): boolean {
    return this.finishedAt !== null;
  }

  private get step(): Step {
    return this.lesson.steps[this.index]!;
  }

  private get mem(): StepMemory {
    return this.memory[this.index]!;
  }

  private challengeStage(): 'sort' | 'then' {
    const step = this.step;
    if (step.type !== 'challenge') return 'sort';
    if (!step.sort) return 'then';
    return this.mem.sorted.length === step.sort.items.length && step.then ? 'then' : 'sort';
  }

  /** The part of the current step that owns the simulation, if any. */
  private activeStage(): ThenStage | Extract<Step, { type: 'hook' | 'poke' | 'zoom' }> | null {
    const step = this.step;
    if (step.type === 'hook' || step.type === 'poke' || step.type === 'zoom') return step;
    if (step.type === 'challenge' && step.then && this.challengeStage() === 'then')
      return step.then;
    return null;
  }

  private climb(): void {
    const step = this.step;
    if (step.type !== 'predict') return;
    const memory = this.mem;
    const hint = step.hints[memory.hintLevel];
    if (hint) {
      memory.hintLevel = (memory.hintLevel + 1) as StepMemory['hintLevel'];
      if (hint.highlight !== undefined) memory.highlight = hint.highlight;
      if (hint.demo !== undefined) memory.demo = hint.demo;
      this.lumi = {
        mood: 'thinking',
        text: { play: hint.play, explain: hint.explain, deep: hint.deep },
      };
    } else {
      memory.hintLevel = 4;
      memory.solved = true;
      memory.ready = true;
      memory.highlight = step.answer;
      this.lumi = { mood: step.reveal.mood ?? 'happy', text: lineText(step.reveal) };
      for (const concept of this.lesson.concepts) this.reviewConcepts.add(concept);
    }
    this.changed();
  }

  private enter(): void {
    const step = this.step;
    const memory = this.mem;
    this.bus.clear();
    this.simState = {};
    this.enteredAt = this.now();
    memory.toggleOn = false;
    if (step.type === 'name_it' || step.type === 'keep') memory.ready = true;
    if (step.type === 'hook' && this.conditions[this.index] === null) memory.ready = true;
    this.lumi = { mood: step.lumi.mood ?? 'happy', text: lineText(step.lumi) };
    this.changed();
  }

  private leave(): void {
    this.mem.ms += this.now() - this.enteredAt;
  }

  private onEvent(event: SimEvent): void {
    const stage = this.activeStage();
    const reactions = stage?.reactions;
    const line =
      reactions?.[`${event.type}:${String(event.value)}`] ?? reactions?.[event.type] ?? undefined;
    if (line) this.lumi = { mood: line.mood ?? 'happy', text: lineText(line) };
    const becameReady = this.checkDone();
    if (line || becameReady) this.changed();
  }

  /** Returns true when the step has just become ready. */
  private checkDone(): boolean {
    const memory = this.mem;
    if (memory.ready) return false;
    const step = this.step;
    const condition =
      step.type === 'challenge'
        ? this.challengeStage() === 'then'
          ? this.thenCondition
          : null
        : this.conditions[this.index];
    if (!condition) return false;
    if (!evaluate(condition, { bus: this.bus, state: this.simState })) return false;
    memory.ready = true;
    const doneLine = this.activeStage()?.done_lumi;
    if (doneLine) {
      const current = this.lumi;
      const reactedJustNow = current.text !== '' && this.isReaction(current.text);
      this.lumi = reactedJustNow
        ? {
            mood: current.mood,
            text: mapDepths(current.text, (value, depth) =>
              `${value} ${resolveText(lineText(doneLine), depth)}`.trim(),
            ),
          }
        : { mood: doneLine.mood ?? 'happy', text: lineText(doneLine) };
    }
    return true;
  }

  /** True when the current line came from a reaction, so a "you may continue" line is appended to it. */
  private isReaction(text: DepthText): boolean {
    const reactions = this.activeStage()?.reactions;
    if (!reactions) return false;
    const shown = resolveText(text, this.depth);
    return Object.values(reactions).some(
      (line) => resolveText(lineText(line), this.depth) === shown,
    );
  }

  private changed(): void {
    this.snapshot = null;
    for (const listener of [...this.listeners]) listener();
  }
}
