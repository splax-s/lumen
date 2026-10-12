# Lumen Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (the owner chose single-session, inline execution). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Lumen learning platform end to end: lesson engine, twenty lessons, the town, the API with accounts and the AI tutor, schools, the landing page and a staff ops console.

**Architecture:** A pnpm and Turborepo monorepo. A framework-free TypeScript engine runs YAML lessons that are validated and compiled at build time; a React app renders the landing page, town, lessons, dashboards and ops console; a FastAPI service with Postgres and Redis handles accounts, progress, the tutor and operations. The web app is local first and syncs when signed in.

**Tech Stack:** pnpm 11, Turborepo, TypeScript strict, React 18, Vite, CSS modules, Zod, Vitest, Testing Library, Playwright, axe; Python 3.12 via uv, FastAPI, SQLAlchemy 2, Alembic, Postgres 16, Redis, Argon2, Anthropic SDK, pytest, Ruff, mypy.

**Spec:** `docs/superpowers/specs/2026-10-12-lumen-build-design.md`, which builds on `BUILD_PROMPT.md` (the brief). Read both. Behaviour reference: `reference/prototype-town-and-ice-lesson.html`. Physics and data reference: `reference/prototype-simulation-lab.html`. Visual reference: `reference/design/*.dc.html`.

**How to read this plan.** This plan fixes the file map, the interfaces between packages, the tests that prove each task and the commands that verify it. It gives code for the interfaces other tasks depend on. It does not reproduce every implementation line, because the executor is the same session that wrote the spec and has both prototypes to port from. Where a task ports a prototype, the line range to port is named.

## Global Constraints

- Colours: only the tokens in brief section 9, as CSS custom properties. No hex values in component CSS outside `tokens.css`, except scientifically conventional colours inside simulations and town object art.
- Type: Bricolage Grotesque 800 for headings and lesson questions only; Atkinson Hyperlegible 400 and 700 for body and buttons; IBM Plex Mono 500 for numbers, units and labels. Self-hosted.
- No gradients, no emoji, no hard offset shadows, no thick outlines on interface elements. Soft shadow only on floating elements.
- Touch targets 48 px or larger on learner screens. Visible focus rings. WCAG AA contrast. `prefers-reduced-motion` respected everywhere.
- At most 12 words on screen outside Lumi's bubble in a lesson step. Every learner-facing lesson string exists at Play, Explain and Deep, with fallback selected depth, then Explain, then Play.
- Lumi says "Not quite", never "wrong". Lumi never gives an answer before two hints.
- The simulation is identical across depths. Only text, numbers shown and challenge difficulty change.
- The town never renders narrower than 880 px and scrolls horizontally inside its own frame.
- No AI call from the browser. No API key in the front end. No third-party trackers.
- Child profiles store a nickname, an avatar and a birth-year band only.
- Every scientific value shown to learners appears in that lesson's `facts` list with a source.
- No `eval` or `new Function` anywhere.
- Every Playwright test fails on a browser console error or unhandled rejection.
- Commit after every task. Tag the last commit of each phase `phase-1` to `phase-5`.
- Every choice not fixed by the brief or the spec gets one line in `DECISIONS.md` at the time it is made.

## Review Focus

Conditions the spec implies but does not spell out, most likely first. Each has a test in the task that owns the code.

1. **Storage unavailable or corrupt.** Private browsing or a damaged `localStorage` value. Expected: the app runs with in-memory progress and shows no error. Test in Task 2.2.
2. **Depth switched in the middle of an interaction.** Expected: dropped items, sorted rows, slider position and hint level are kept, and only text changes. Test in Task 1.9.
3. **API unreachable while signed in.** Expected: lessons and the town keep working, attempts queue locally, and sync resumes later without duplicates. Test in Task 3.9.
4. **Double activation.** Continue pressed twice quickly, or a lesson finished twice. Expected: one step advance, one card, one attempt record. Tests in Tasks 1.6 and 3.5.
5. **Speech or audio not available.** No `speechSynthesis` or a blocked `AudioContext`. Expected: the read-aloud button is hidden or inert and music lessons show a "tap to enable sound" control, with no thrown error. Tests in Tasks 1.8 and 4.5.

---

## File structure

```
package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json  eslint.config.js  .prettierrc
docker-compose.yml  .github/workflows/ci.yml  DECISIONS.md  BUILD_REPORT.md  README.md
packages/engine/src/
  depth.ts            Depth, DepthText, resolveText
  events.ts           SimEvent, EventBus
  condition.ts        parseCondition, evaluate (done_when)
  schema.ts           Zod lesson schema and Lesson types
  runtime.ts          LessonRuntime state machine
  random.ts           seeded random number generator
  sim/types.ts        Simulation, SimEnv, SimView
  sim/registry.ts     lazy loaders by kind
  sim/<kind>.ts       one file per simulation, twenty in total
  sim/data/           items.ts (densities), bach.ts (bars 1 to 19), notes.ts
  audio.ts            AudioEngine interface, Tone.js synth implementation
packages/lessons/
  content/<subject>/<slug>.yaml     twenty lessons
  catalog.yaml                      town objects, places, threads, where-else entries
  scripts/build.ts                  validate and compile to dist/
  src/index.ts                      typed access to compiled output
packages/design/src/
  tokens.css  fonts.css  base.css
  Lumi.tsx  Button.tsx  DepthSwitch.tsx  Card.tsx  Chip.tsx  ProgressDots.tsx  BottomSheet.tsx  LumiStrip.tsx  SubjectDot.tsx
packages/town/src/
  Town.tsx  scene/Backdrop.tsx  objects/<Object>.tsx (21)  Threads.tsx  ConceptWeb.tsx  state.ts
apps/web/src/
  main.tsx  routes.tsx  i18n/en.json  i18n/index.ts
  landing/  town/  lesson/  auth/  parent/  teacher/  ops/  legal/
  lesson/SimCanvas.tsx  lesson/steps/<StepType>.tsx  lesson/interactions/<Type>.tsx
  state/progress.ts  state/sync.ts  state/session.ts  state/entitlements.ts
  services/narration.ts  services/api.ts  services/analytics.ts
apps/api/
  pyproject.toml  alembic/  src/lumen_api/
    main.py  config.py  db.py  deps.py  security.py  ratelimit.py  cli.py
    models/  schemas/  routers/ (auth, profiles, town, lessons, attempts, lumi, parent, school, ops, events)
    services/ (mastery, streak, report, lesson_sync, entitlements, retention, audit)
    lumi/ (provider, anthropic_provider, openai_provider, safety, prompt, service)
  tests/
e2e/  playwright.config.ts  fixtures.ts  tests/*.spec.ts
```

---

## Phase 1: Foundations and the reference lesson

### Task 1.1: Workspace, tooling and local services

**Files:** create the root files listed above, an empty package skeleton for each of `packages/{engine,lessons,design,town}`, `apps/web`, `apps/api`, `e2e`, plus `DECISIONS.md`.

- [ ] Root `package.json` with scripts `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `format`, each delegating to Turborepo. `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- [ ] `apps/api`: `uv init`, pin Python 3.12 (`uv python install 3.12`), add FastAPI, SQLAlchemy, Alembic, asyncpg, redis, argon2-cffi, pydantic-settings, anthropic, httpx, and dev tools pytest, pytest-asyncio, ruff, mypy.
- [ ] `docker-compose.yml` with `postgres:16` and `redis:7`. Run `docker compose up -d db redis`. If Docker is not running, record it in `DECISIONS.md` and point `DATABASE_URL` at the local Postgres 14.
- [ ] `.github/workflows/ci.yml` running the same commands with Postgres and Redis service containers.
- [ ] Verify: `pnpm install && pnpm lint && pnpm typecheck && pnpm test` exit 0 on the empty skeleton; `uv run ruff check && uv run mypy src && uv run pytest` exit 0.
- [ ] Commit.

### Task 1.2: Design tokens, fonts and Lumi

**Files:** `packages/design/src/*`, tests `packages/design/src/__tests__/{Lumi,DepthSwitch,Button}.test.tsx`.

**Produces:**

```ts
export type Mood = 'happy' | 'thinking' | 'wow' | 'proud';
export function Lumi(props: { mood: Mood; size?: number; title?: string }): JSX.Element;
export function DepthSwitch(props: { value: Depth; onChange: (d: Depth) => void; compact?: boolean }): JSX.Element;
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary'; size?: 'md' | 'lg' }): JSX.Element;
export function LumiStrip(props: { mood: Mood; text: string; onSpeak?: () => void; children?: ReactNode }): JSX.Element;
```

- [ ] `tokens.css`: every token in brief sections 9.1 and 9.2 as `--lm-*` custom properties, plus radius, shadow and font tokens, plus a dark set under `[data-theme="dark"]`.
- [ ] Fonts through `@fontsource-variable/bricolage-grotesque`, `@fontsource/atkinson-hyperlegible`, `@fontsource/ibm-plex-mono`, Latin subset only.
- [ ] Lumi: four mood components from `reference/design/Lumi.dc.html` lines 22 to 61, with ink `#16161D` in place of the mockup's navy. Bulb fill: happy pale, thinking white, wow larger, proud largest with a stronger halo. Bob and blink animations off under reduced motion.
- [ ] Tests: each mood renders an accessible name ("Lumi happy" and so on); DepthSwitch is a radio group that moves with arrow keys and calls `onChange`; Button renders at least 48 px tall.
- [ ] Verify: `pnpm --filter @lumen/design test`. Commit.

### Task 1.3: Depth text, event bus and seeded random

**Files:** `packages/engine/src/{depth,events,random}.ts` and tests beside them.

**Produces:**

```ts
export type Depth = 'play' | 'explain' | 'deep';
export type DepthText = string | { play?: string; explain?: string; deep?: string };
export function resolveText(text: DepthText, depth: Depth): string; // selected, then explain, then play, then ''

export type SimEvent = { type: string; value?: string | number; t: number };
export class EventBus {
  emit(event: { type: string; value?: string | number }): void;
  on(listener: (e: SimEvent) => void): () => void;
  log(): readonly SimEvent[];
  count(type: string): number;                       // distinct values if events carry values, else occurrences
  has(type: string, value: string | number): boolean;
  seen(type: string): boolean;
  clear(): void;
}
export function createRandom(seed: number): () => number; // mulberry32
```

- [ ] Tests first: fallback order for each depth including a Deep-only gap; `count('dropped')` is 2 after dropping coin, coin, ice; listeners removed by the returned function stop receiving; `createRandom(1)` gives the same sequence twice.
- [ ] Implement, run `pnpm --filter @lumen/engine test`, commit.

### Task 1.4: `done_when` evaluator

**Files:** `packages/engine/src/condition.ts`, `condition.test.ts`.

**Produces:**

```ts
export class ConditionError extends Error { readonly position: number }
export type Condition = { readonly source: string; readonly ast: Node };
export function parseCondition(source: string): Condition;
export function evaluate(c: Condition, ctx: { bus: EventBus; state: Record<string, number | string | boolean> }): boolean;
```

Grammar: `or := and ('||' and)*`, `and := not ('&&' not)*`, `not := '!' not | cmp`, `cmp := value (op value)?`, `value := number | string | call | identifier | '(' or ')'`. Calls: `count(name)`, `has(name, value)`, `event(name)`, `state(name)`. A bare identifier reads `ctx.state`. Unknown identifiers evaluate to `0`.

- [ ] Tests first, including: `count(dropped) >= 3 && has(dropped, 'ice')` true and false cases; `event('froze')`; precedence of `||` under `&&`; `!event('died')`; `temperature <= 0` from state; and parse errors with a position for `count(`, `1 +`, `foo(1)`, an unterminated string and an empty string.
- [ ] Implement with a hand-written tokenizer and recursive descent. Run tests. Commit.

### Task 1.5: Lesson schema

**Files:** `packages/engine/src/schema.ts`, `schema.test.ts`.

**Produces:** `lessonSchema` (Zod) and the inferred types `Lesson`, `Step`, `HookStep`, `PokeStep`, `PredictStep`, `ZoomStep`, `NameItStep`, `ChallengeStep`, `KeepStep`, `LumiLine = { mood?: Mood } & DepthText fields`, `Hint = DepthText & { highlight?: string; demo?: boolean }`.

Every step has `type`, an optional `title: DepthText` (the on-screen question, 12 words at most, checked by the schema), an optional `sim: { kind: string; [param: string]: unknown }`, an optional `lumi`, and an optional `done_when`. `predict` adds `question`, `choices: { id, label: DepthText, art: string }[]` (exactly three), `answer`, `hints` (two or three), `correct: LumiLine`. `challenge` adds `sort: { items: { id, name, value?: DepthText, bin }[]; bins: [string, string] }`, an optional `then` step with a toggle, and per-item wrong-answer lines. `keep` adds `where_else: { title, text: DepthText, lesson?: string }[]`. Top level: `id`, `title`, `subject`, `object`, `threads` (at least one), `needs`, `concepts`, `card`, `summary: DepthText`, `facts: { text: string; source: string }[]` (at least one), `steps` in the fixed order hook, poke, predict, zoom, name_it, challenge, keep.

- [ ] Tests first: the brief's section 11.2 example (completed with required fields) parses; a title of 13 words fails; steps out of order fail; a predict `answer` that is not a choice fails; a lesson with no thread fails; any string containing the whole word "wrong" fails.
- [ ] Implement. Run tests. Commit.

### Task 1.6: Lesson runtime

**Files:** `packages/engine/src/runtime.ts`, `runtime.test.ts`.

**Produces:**

```ts
export type RuntimeState = {
  stepIndex: number; stepCount: number; step: Step;
  ready: boolean;                      // Continue enabled
  hintLevel: 0 | 1 | 2 | 3 | 4;        // 0 none, 1 nudge, 2 clue, 3 demo, 4 answer shown
  highlight: string | null;            // choice to glow at clue level
  lumi: { mood: Mood; text: DepthText };
  depth: Depth; finished: boolean;
};
export type AttemptRecord = {
  lessonId: string; depth: Depth; startedAt: number; finishedAt: number | null;
  steps: { type: string; wrong: number; hintLevel: number; ms: number }[];
  hintsUsed: number; reviewConcepts: string[];
};
export class LessonRuntime {
  constructor(lesson: Lesson, opts: { depth: Depth; now?: () => number });
  readonly bus: EventBus;
  getState(): RuntimeState;
  subscribe(fn: () => void): () => void;
  setDepth(d: Depth): void;
  setSimState(state: Record<string, number | string | boolean>): void; // re-evaluates done_when
  say(line: LumiLine): void;
  answerPredict(choiceId: string): 'correct' | 'not_quite';
  answerSort(itemId: string, bin: string): 'correct' | 'not_quite';
  completeThen(): void;                // the challenge's follow-up toggle was used
  next(): boolean;                     // false if not ready or already advancing
  back(): void;
  attempt(): AttemptRecord;
}
```

Rules: hook, name_it and keep are ready on entry. Poke and zoom become ready when `done_when` is true and stay ready. Predict: first miss gives the nudge, second the clue with `highlight`, third the demo, fourth shows the answer, sets ready and adds the lesson's concepts to `reviewConcepts`; a correct pick at any point sets ready. Challenge: ready when all items are sorted and, if `then` exists, `completeThen()` was called. `next()` on the last step sets `finished`. `back()` returns to a step with its ready state kept. The bus is cleared on entering a step for the first time only.

- [ ] Tests first, covering each rule above, plus: `next()` called twice in the same tick advances once (Review Focus 4); `setDepth` changes `lumi` text resolution but not `ready`, `hintLevel` or the bus log; the attempt record counts hints and wrong answers.
- [ ] Implement. Run tests. Commit.

### Task 1.7: Simulations `tank`, `molecules`, `lake`

**Files:** `packages/engine/src/sim/{types,registry,tank,molecules,lake}.ts`, `sim/data/items.ts`, tests per simulation.

**Produces:**

```ts
export type SimColors = Record<'ink' | 'paper' | 'mist' | 'line' | 'graphite' | 'water' | 'sky' | 'ground' | 'accent', string>;
export type SimView = { width: number; height: number; colors: SimColors; time: number };
export type SimEnv = { bus: EventBus; depth: () => Depth; random: () => number; reducedMotion: boolean };
export interface Simulation {
  init(config: Record<string, unknown>, env: SimEnv): void;
  step(dt: number): void;
  render(ctx: CanvasRenderingContext2D, view: SimView): void;
  setParam(key: string, value: number | string | boolean): void;
  getState(): Record<string, number | string | boolean>;
  emit(event: { type: string; value?: string | number }): void;
  describe(): string;                  // one-sentence text alternative for screen readers
}
export const simRegistry: Record<string, () => Promise<{ default: new () => Simulation }>>;
```

- [ ] `tank`: port prototype lines 473 to 507. Physics lives in normalised units in `step` so it can be tested without a canvas. `setParam('drop', id)` adds an item and emits `dropped` with the item ID; `settled` is emitted once per item. Floaters settle with submerged fraction equal to density divided by 1.00. Labels by depth exactly as brief section 4.5.
  Tests: ice settles with 0.92 of its height below the surface within 2 percent; cork 0.24; apple 0.8; coin and stone rest on the floor; `dropped` then `settled` are emitted in that order; a zero-size view renders without throwing.
- [ ] `molecules`: port lines 510 to 542. 48 molecules, 104.5 degree H–O–H angle, hexagonal lattice with dashed bonds below 0 °C, container width factor `1 + 0.09 * f`. Emits `froze` when `f > 0.95` and `melted` when `f < 0.05` after having frozen. State: `temperature`, `frozen`, `space` (100 to 109).
  Tests: at 20 °C after 5 s `space` is 100 and no event; at −5 °C after 5 s `space` is 109 and `froze` fired exactly once; warming again fires `melted`.
- [ ] `lake`: port lines 545 to 569. `setParam('mode', 'real' | 'sank')`. Emits `froze` with value `lid` or `solid`, and `trapped` per fish. State: `fishSwimming`.
  Tests: in `real` mode after 20 s all 6 fish swim and ice covers at most 22 percent of the depth; in `sank` mode after 20 s fewer than 6 swim; switching back restores 6.
- [ ] Run tests. Commit.

### Task 1.8: Web shell, canvas host, narration and interactions

**Files:** `apps/web` Vite setup, `src/main.tsx`, `routes.tsx`, `i18n/*`, `lesson/SimCanvas.tsx`, `lesson/interactions/{Predict,Sort,Slide,TapTray}.tsx`, `services/narration.ts`, tests beside each.

**Produces:**

```ts
export function SimCanvas(props: { kind: string; config: Record<string, unknown>; bus: EventBus; depth: Depth;
  params?: Record<string, number | string | boolean>; onState?: (s: Record<string, number | string | boolean>) => void; label: string }): JSX.Element;
export const narration: { available(): boolean; speak(text: string, lineId?: string): void; stop(): void };
export function t(key: string, vars?: Record<string, string | number>): string;
```

- [ ] `SimCanvas`: lazy-loads the simulation, sizes with `ResizeObserver`, caps device pixel ratio at 2, caps `dt` at 0.05 s, pauses when the document is hidden, renders one settled frame under reduced motion (stepping the simulation forward without animating), reads colours from CSS custom properties once per theme change, and exposes `describe()` through `aria-label` on a `role="img"` wrapper.
- [ ] `narration`: looks for `/audio/<lineId>.mp3` in a manifest, else Web Speech at rate 0.95; `available()` is false when neither exists and the read-aloud button is then not rendered (Review Focus 5).
- [ ] Interactions as controlled components: Predict (three picture buttons, glow on highlight, dimmed after a miss), Sort (rows with two bin buttons, shake replaced by a colour change under reduced motion), Slide (native range input with label and mono output), TapTray (item buttons that disable after use).
- [ ] Tests: SimCanvas mounts and unmounts without leaking an animation frame; narration with no `speechSynthesis` reports unavailable and `speak` does not throw; each interaction is operable with keyboard only.
- [ ] Commit.

### Task 1.9: `ice-floats.yaml`, the lessons build and the lesson screen

**Files:** `packages/lessons/content/chemistry/ice-floats.yaml`, `packages/lessons/catalog.yaml`, `packages/lessons/scripts/build.ts`, `packages/lessons/src/index.ts`, `apps/web/src/lesson/{LessonPage,LessonHeader,LessonFooter}.tsx`, `lesson/steps/{Hook,Poke,Predict,Zoom,NameIt,Challenge,Keep}.tsx`, tests.

- [ ] Write `ice-floats.yaml` in full. Every line of Lumi text at three depths is taken from prototype lines 586 to 650. Values: coin 8.9, cork 0.24, ice 0.92, apple 0.8, stone 2.6; sort items log 0.7 F, stone 2.6 S, iceberg 0.92 F, steel bolt 7.8 S, cooking oil 0.92 F, honey 1.42 S. `facts` with sources.
- [ ] `build.ts`: read every YAML, validate with `lessonSchema`, parse each `done_when`, cross-check `needs`, `threads`, `object` and `where_else` against `catalog.yaml`, write `dist/<id>.json` and `dist/index.json`. Exit 1 with file and path on any error. Test: a fixture with a bad `done_when` fails with the file name in the message.
- [ ] Lesson screen laid out as `reference/design/Lesson.dc.html` on desktop and `Phone.dc.html` below 720 px: header (back, subject chip, step dots, depth switch), stage, footer (Lumi strip, Back and Continue). Continue's label on the phone layout names what is missing when disabled ("Pick an answer").
- [ ] Component test (Review Focus 2): in Poke, drop coin and ice, switch to Deep, assert both items remain, the tray buttons stay disabled, and labels now show density.
- [ ] Verify: `pnpm --filter @lumen/lessons build && pnpm test`. Commit.

### Task 1.10: End-to-end test of the ice lesson and Phase 1 gate

**Files:** `e2e/playwright.config.ts`, `e2e/fixtures.ts` (console-error guard, axe helper, overflow helper), `e2e/tests/ice-lesson.spec.ts`, `e2e/tests/layout.spec.ts`, `e2e/tests/perf.spec.ts`.

- [ ] `ice-lesson.spec.ts`: plays all seven steps by pointer at 1280 px and by keyboard at 390 px, at each of the three depths; takes the wrong predict choice twice to see nudge then clue then the glow; asserts "Space taken: 109%" after sliding to −10 °C; sorts all six; toggles "What if ice sank?"; reaches the card.
- [ ] `layout.spec.ts`: for each step at 390, 768, 1280 and 1440 px, assert no horizontal page overflow, no clipped text, targets at least 48 px, and axe with no serious or critical violations.
- [ ] `perf.spec.ts`: with 4x CPU throttling through the Chrome DevTools protocol, the tank and molecules steps hold a median frame time under 16.7 ms and a 95th percentile under 33 ms.
- [ ] Take screenshots of every step at 390 and 1280 px and read them. Fix anything that looks off.
- [ ] Run the full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`. Commit and tag `phase-1`.

---

## Phase 2: Town and progress

### Task 2.1: Catalog and town state

**Files:** `packages/lessons/catalog.yaml` (complete), `packages/town/src/state.ts`, `state.test.ts`.

**Produces:**

```ts
export type ObjectState = 'done' | 'next' | 'available' | 'locked' | 'soon';
export type TownObject = { id: string; lessonId: string | null; subject: Subject; place: Place; question: string; blurb: string;
  x: number; y: number; threads: string[]; needs: string[] };
export function objectStates(objects: TownObject[], done: ReadonlySet<string>): Record<string, ObjectState>;
export function lockedBy(object: TownObject, done: ReadonlySet<string>, all: TownObject[]): TownObject | null;
```

`next` rule: among objects that are not done and have all prerequisites done, mark at most two: first the successor of the most recently finished lesson if it exists, then the first in curriculum order. With nothing finished, only the glass is `next`.

- [ ] Catalog: twenty objects with places per brief section 6, the radio dish as `soon`, the six threads with the members in brief section 5.3.
- [ ] Tests: nothing done gives glass `next`, kettle `locked`; glass done gives kettle `next`; never more than two `next`; the dish is always `soon`; `lockedBy` returns the unmet prerequisite.
- [ ] Commit.

### Task 2.2: Progress store

**Files:** `apps/web/src/state/progress.ts`, `progress.test.ts`.

**Produces:**

```ts
export type Progress = { version: 1; depth: Depth; done: { lessonId: string; at: number }[]; cards: { lessonId: string; at: number }[];
  streak: { current: number; longest: number; lastDay: string | null; restDaysLeft: number }; pendingAttempts: AttemptRecord[] };
export const progress: { get(): Progress; subscribe(fn: () => void): () => void; setDepth(d: Depth): void;
  completeLesson(a: AttemptRecord): void; reset(): void; replace(p: Progress): void };
```

- [ ] Tests: completing the same lesson twice yields one card and one `done` entry; streak increments on consecutive days, holds on the same day, uses a rest day for one missed day and resets after more; `localStorage.setItem` throwing leaves the store working in memory; a corrupt stored value loads as empty progress (Review Focus 1).
- [ ] Commit.

### Task 2.3: Town scene and objects

**Files:** `packages/town/src/Town.tsx`, `scene/Backdrop.tsx`, `objects/*.tsx`, `Threads.tsx`, CSS modules, tests.

- [ ] Backdrop: cut-away house with rooftop terrace and water tank, music room, kitchen, garden, playground and sky, at view box 1440 by 700, drawn with `line` and `graphite` strokes on white and mist. Port geometry from prototype lines 358 to 383.
- [ ] Twenty-one object components with props `{ state: ObjectState; onOpen: () => void }`. Seventeen port prototype lines 291 to 342. New art: rusty gate, dice on the garden bench, beetles under a leaf, record player. Line art in `line-strong` until done, then real colours, a subject-coloured check badge and an idle animation (steam, swing, and so on).
- [ ] `next` shows the dashed lumi ring and a "Start here" or "Next up" tag. Objects are buttons in reading order with accessible names that include the state.
- [ ] Threads: animated dashed path through member objects and dimming of the rest; static dashes under reduced motion.
- [ ] Tests: each state renders its marker; a thread dims non-members; the frame's inner width is at least 880 px.
- [ ] Commit.

### Task 2.4: Town page, bottom sheet, sidebar and lesson hand-off

**Files:** `apps/web/src/town/{TownPage,ObjectSheet,Sidebar,DailyChallenge,CardList,TownHeader}.tsx`, `e2e/tests/town.spec.ts`.

- [ ] Header: learner name, per-subject progress out of 4, streak, depth switch. Sidebar: daily one-minute challenge, thread chips, recent cards. Lumi strip under the town with a button that starts the `next` lesson.
- [ ] Bottom sheet: subject and place, question, blurb, thread chips, Start or Play again, or "Opens after: [lesson]" when locked, or "Coming soon". Focus is trapped while open and returns to the object on close. Escape closes.
- [ ] Finishing a lesson calls `progress.completeLesson`, returns to the town and scrolls the object into view.
- [ ] `town.spec.ts`: finish the ice lesson, then the glass is painted and the kettle has the next ring; toggling "Tiny particles" draws the path and dims the swing; at 390 px the town frame scrolls horizontally and the page does not; the sheet is keyboard operable.
- [ ] Screenshots at 390 and 1440 px, read them, fix. Commit.

### Task 2.5: Concept web view and Phase 2 gate

**Files:** `packages/town/src/ConceptWeb.tsx`, test.

- [ ] A toggle in the town header switches to an SVG diagram: lessons as nodes grouped by subject in five columns, solid edges for prerequisites, dashed for threads, same state colours, same sheet on activation.
- [ ] Full gate, commit, tag `phase-2`.

---

## Phase 3: Backend, accounts, AI tutor, ops console

### Task 3.1: API foundation

**Files:** `apps/api/src/lumen_api/{main,config,db,deps}.py`, `alembic/`, `tests/conftest.py`, `tests/test_health.py`.

- [ ] Settings through pydantic-settings: `DATABASE_URL`, `REDIS_URL`, `SESSION_TTL_HOURS`, `LUMI_PROVIDER` (`anthropic`, `openai_compatible`, `none`), `LUMI_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `TUTOR_RETENTION_DAYS=90`, `CORS_ORIGINS`.
- [ ] Async SQLAlchemy engine and session dependency. Test fixtures create a fresh schema per test session and roll back per test. `GET /health` reports database and Redis status.
- [ ] Verify: `uv run pytest`. Commit.

### Task 3.2: Models and first migration

**Files:** `models/*.py`, `alembic/versions/0001_initial.py`, `tests/test_models.py`.

- [ ] Tables from brief section 12 plus `ops_audit_log`, `feature_flag`, `analytics_event`, `tutor_review`. `parent_account` gains `role` (`user`, `teacher`) and `staff_level` (null, `support`, `admin`) and `plan` (`free`, `family`, `school`). Every table that references `learner_profile` uses `ON DELETE CASCADE`.
- [ ] Test: migration up and down runs clean; the cascade is declared on every foreign key to `learner_profile` (introspected, so a new table cannot forget it).
- [ ] Commit.

### Task 3.3: Auth and profiles

**Files:** `security.py`, `ratelimit.py`, `routers/{auth,profiles}.py`, `schemas/`, tests.

- [ ] `POST /auth/signup` (email, password of at least 10 characters, country, consent), `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Argon2id hashes. Opaque session token in Redis, `HttpOnly` `SameSite=Lax` cookie. Login is rate limited to 10 per 15 minutes per email and address.
- [ ] `GET/POST /profiles`, `PATCH /profiles/:id`, `DELETE /profiles/:id`, `GET /profiles/:id/export`. Profile fields: nickname (1 to 20 characters, letters, digits, spaces), avatar ID, `birth_year_band`, `default_depth`, `chat_unlocked`. The schema rejects any other field.
- [ ] Tests: duplicate email; wrong password gives the same message as unknown email; one account cannot read, change, export or delete another's profile (404); rate limit triggers; extra profile fields such as `email` or `school` are rejected with 422.
- [ ] Commit.

### Task 3.4: Lesson sync, town and entitlements

**Files:** `services/{lesson_sync,entitlements}.py`, `routers/{lessons,town}.py`, `cli.py`, tests.

- [ ] `lumen-api sync-lessons` loads `packages/lessons/dist/index.json` into `lesson`. `GET /lessons/:id` returns the compiled lesson if entitled, else 402 with the reason. `GET /town?profile=` returns object states, threads, cards and streak, using the same `next` rule as Task 2.1 (shared fixtures in `packages/lessons/fixtures/town-states.json` are asserted by both test suites).
- [ ] `can_play(lesson, account)`: free covers lesson numbers 1, 5, 9, 13 and 17; family and school cover all.
- [ ] Tests for each rule. Commit.

### Task 3.5: Attempts, mastery, cards, streaks

**Files:** `routers/attempts.py`, `services/{mastery,streak}.py`, tests.

- [ ] `POST /attempts` (with a client-generated ID for idempotency), `PATCH /attempts/:id`, `POST /attempts/:id/complete`. Completing twice returns the same result and creates one card (Review Focus 4).
- [ ] Mastery: on completion each concept moves `score = score + (1 - score) * 0.4`; a concept in `reviewConcepts` moves `score = score * 0.6`. Next review after 1, 3, 7, 16, 35 days by successive success count, reset to 1 day on a review flag.
- [ ] Tests for the arithmetic and schedule, for idempotency, and for streaks matching Task 2.2's rules.
- [ ] Commit.

### Task 3.6: Lumi service

**Files:** `lumi/{provider,anthropic_provider,openai_provider,safety,prompt,service}.py`, `routers/lumi.py`, tests.

**Produces:**

```python
class TutorProvider(Protocol):
    name: str
    async def complete(self, system: str, messages: list[Message], max_tokens: int) -> str: ...
    async def judge(self, reply: str, facts: list[str], depth: str) -> Verdict: ...

@dataclass
class Verdict: on_topic: bool; age_appropriate: bool; consistent: bool; reason: str
@dataclass
class TutorReply: text: str; source: Literal["model", "scripted"]; safety_result: str; mood: str
```

- [ ] Before writing the Anthropic provider, load the `claude-api` skill and follow it for the SDK calls and model ID.
- [ ] `/lumi/ask`: refuses free text with 403 for a profile in the under-13 band without `chat_unlocked` and returns suggested questions instead; rate limited per profile; refuses to reveal an answer when the recorded hint level for the step is below 2; runs the pipeline in spec section 7; stores both the question and the reply in `tutor_message` with `safety_result`.
- [ ] `/lumi/diagnose`: takes lesson, step and the wrong choice; returns a misconception from the lesson's scripted table first, the model second, and a linked lesson ID.
- [ ] Rule-based checks in `safety.py`: length by depth, personal-data request patterns (name, age, address, school, phone, photo, email), the word "wrong", links, and input screening for the same personal-data patterns.
- [ ] Tests with a fake provider: under-13 blocked; unlocked child allowed; a reply asking "what school do you go to" is replaced by a scripted line and logged as `blocked:personal_data`; an off-topic verdict falls back; a provider exception falls back and is logged as `error:provider`; provider `none` always returns scripted; every path writes a `tutor_message` row.
- [ ] Commit.

### Task 3.7: Weekly report, data rights and retention

**Files:** `services/{report,retention}.py`, `routers/parent.py`, tests.

- [ ] `GET /parent/report/weekly?profile=`: lessons finished, concepts mastered, where hints were needed, and one thing to try at home taken from each lesson's `where_else`.
- [ ] Deleting a profile removes every row that references it. The test inserts one row into every table for a profile, deletes the profile, and asserts zero rows remain in each, by introspecting the schema.
- [ ] `lumen-api purge-tutor-messages` deletes messages older than the retention period. Test with a frozen clock.
- [ ] `docs/data-map.md`: every stored field, why it is stored, how long it is kept.
- [ ] Commit.

### Task 3.8: Ops API

**Files:** `routers/ops.py`, `services/audit.py`, `cli.py` (`create-staff`), tests.

- [ ] Endpoints under `/ops`: `overview`, `accounts` (search, detail, set plan, set chat lock, export, delete), `tutor-log` (list, mark reviewed), `system` (config view, flags, run purge), `audit-log`. `support` may read, export and delete on a data-rights request; only `admin` may change plans, flags or run the purge.
- [ ] Every endpoint depends on `require_staff(level)`. Every call that reads personal data or changes state writes an audit row.
- [ ] Tests: a parametrised test walks every `/ops` route in the app's route table and asserts 401 signed out and 403 for a normal account, so a new route cannot be left open; `support` gets 403 on admin actions; each action writes one audit row; the config endpoint never includes a key value.
- [ ] Commit.

### Task 3.9: Web accounts, sync and parent dashboard

**Files:** `apps/web/src/{auth,parent}/*`, `state/{session,sync,entitlements}.ts`, `services/api.ts`, tests, `e2e/tests/accounts.spec.ts`.

- [ ] Sign-up, log-in, profile picker with avatar and nickname, parent dashboard (profiles, chat unlock, weekly report, export, delete with typed confirmation).
- [ ] Sync: on sign-in, pending attempts are posted with their client IDs, then local progress is replaced by the merged server view. Failures keep the queue and retry with backoff.
- [ ] Lumi panel in lessons: suggested questions for every profile, free text only when the server allows it.
- [ ] Tests: with the API unreachable, a lesson can be finished and the attempt stays queued; when the API returns, one attempt is created (Review Focus 3). End to end against the real API: sign up, add a child, finish the ice lesson, see it in the parent report, delete the child.
- [ ] Commit.

### Task 3.10: Ops console screens and Phase 3 gate

**Files:** `apps/web/src/ops/{OpsLayout,Overview,Accounts,AccountDetail,TutorLog,System,AuditLog}.tsx`, shared `ops/DataTable.tsx`, `e2e/tests/ops.spec.ts`.

- [ ] Layout: left navigation that collapses to a top menu under 900 px, tables inside their own scrolling box, empty, loading and error states for every screen, typed confirmation on destructive actions.
- [ ] `ops.spec.ts`: a normal account is redirected away from `/ops`; staff can search an account, lock chat, export and see the audit row; layout and axe checks at the four widths; screenshots read.
- [ ] Full gate including `uv run ruff check && uv run mypy src && uv run pytest`. Commit and tag `phase-3`.

---

## Phase 4: Nineteen lessons, landing page, schools

### Tasks 4.1 to 4.4: Lesson rounds

Each lesson is one unit of work with the same six steps:

- [ ] Simulation in `packages/engine/src/sim/<kind>.ts` with physics in `step`, events on the bus, `describe()`, and unit tests that pin the physics named below.
- [ ] Any new interaction type the lesson needs (`drag`, `build`, `draw`), built once and reused.
- [ ] YAML with all seven steps at three depths, a hint ladder on the predict step, and `facts` with sources.
- [ ] Register the simulation kind and run the lessons build.
- [ ] Playwright smoke test that plays the lesson to its card at 390 px, plus the shared layout and axe checks on every step.
- [ ] Screenshots read, then commit.

| Round | Lesson | Simulation | Physics test |
|---|---|---|---|
| 4.1 | Kettle | `particles` | Mean particle speed scales with the square root of absolute temperature; particles leave the liquid only above a threshold energy; boiling plateau at 100 °C at sea level |
| 4.1 | Swing | `pendulum` | Small-angle period matches 2π√(L/g) within 1 percent for L of 1, 2 and 4 m; period does not change with mass; RK4 conserves energy within 0.5 percent over 60 s; Deep twin starts 0.001 rad apart and diverges (port lab lines 197 to 227) |
| 4.1 | Kitchen scale | `scale` | Displayed mass equals the sum of the items; unit conversion g and kg exact; a cup of flour and a cup of water differ |
| 4.1 | Onion | `cells` | Zoom levels map to stated magnifications; cell count in view scales with the inverse square of magnification |
| 4.1 | Guitar | `string` | Frequency doubles when length halves; frequency scales with the square root of tension; open A string gives 110 Hz for its stated length, tension and mass per length |
| 4.2 | Baking soda | `kinetics` | Port lab lines 230 to 275: reaction fraction rises with temperature and falls with barrier; speeds scale with √T; atoms are conserved |
| 4.2 | Seesaw | `lever` | Balance exactly when m₁d₁ equals m₂d₂; tilt direction follows the larger torque |
| 4.2 | Sunflower | `phyllotaxis` | Seed n sits at angle n times the chosen angle and radius c√n; at 137.5 degrees the packing measure is highest of a sweep; at 90 degrees four spokes |
| 4.2 | Seedling | `growth` | No growth with any of light, water or warmth at zero; growth rate limited by the scarcest factor |
| 4.2 | Djembe | `beat_circle` | Step timing equals 60 / bpm / subdivisions; loop length exact; scheduled times do not drift over 100 loops |
| 4.3 | Rusty gate | `kinetics` in rust mode | No rust without both oxygen and water; rate rises with salt; atoms conserved |
| 4.3 | Telescope | `optics` | Thin lens: 1/f = 1/dₒ + 1/dᵢ within 0.1 percent; magnification equals objective focal length over eyepiece focal length |
| 4.3 | Slide | `slope` | Slope equals rise over run; frictionless speed at the bottom equals √(2gh) and depends on height only |
| 4.3 | Bee | `pollination` | A flower sets fruit only after pollen from another flower of the same kind arrives |
| 4.3 | Piano | `keyboard` | Equal-temperament frequencies from A4 = 440 Hz; key hue equals pitch class times 30 degrees; a major triad is intervals 4 and 3 semitones |
| 4.4 | Moon | `orbit` | Lit fraction equals (1 − cos phase angle) / 2; cycle 29.5 days; half the Moon is always lit |
| 4.4 | Dice | `dice` | One die is uniform within tolerance over 60,000 seeded rolls; the sum of two dice peaks at 7 with probability 6/36 |
| 4.4 | Beetles | `selection` | Port lab lines 278 to 311: with mutation at zero the trait variance does not grow; with no food difference there is no directional change; population stays within its cap |
| 4.4 | Record player | `piano_roll` | Bars 1 to 19 match the lab's note table exactly (port lines 314 to 324); 16 sixteenth notes per bar; chord names per bar as in the lab |

### Task 4.5: Audio engine

**Files:** `packages/engine/src/audio.ts`, tests.

- [ ] `AudioEngine` with `resume()`, `playNote(midi, when, duration)`, `stopAll()`, built on Tone.js with a synthesised piano voice and a `loadSamples(urls)` hook that is unused. Created only after a user gesture.
- [ ] Tests: with no `AudioContext`, music lessons render, show the "Tap to enable sound" control as unavailable, and stay playable visually (Review Focus 5).
- [ ] Commit.

### Task 4.6: Landing page

**Files:** `apps/web/src/landing/*`, `e2e/tests/landing.spec.ts`.

- [ ] Every section of `reference/design/Main.dc.html` in order, with its copy, as CSS modules on tokens. Hero 68 px on desktop scaling down to 40 px on phones. Nav collapses to a menu button under 760 px. `[PRICE]`, `[N]` and `[CURRICULUM]` stay as visible placeholders read from one config file.
- [ ] "Try a lesson" opens the ice lesson signed out. "Get started" opens sign-up.
- [ ] Layout, axe and screenshot checks at the four widths. Commit.

### Task 4.7: Schools and teacher dashboard

**Files:** `apps/api/src/lumen_api/routers/school.py`, migration `0002_schools.py`, `apps/web/src/teacher/*`, tests.

- [ ] Teacher creates classes and gets a join code. Pupils join with a code and a nickname, which creates a profile owned by the class. Assignments attach a lesson and a due date to a class and mark the town object "Assigned".
- [ ] Dashboard: class grid of pupils by lessons, completion, hints used, and the most common wrong predict choice per lesson.
- [ ] Tests: a teacher cannot see another teacher's class; join codes expire and are rate limited; a pupil profile holds no more than the child fields.
- [ ] Commit.

### Task 4.8: Ops Lessons and Schools screens, and Phase 4 gate

- [ ] `/ops/lessons` (versions, starts, completions, average hints, the step with the most exits, re-sync) and `/ops/schools` (create a school, attach a teacher), with API endpoints, permission tests and audit rows.
- [ ] Full gate. Commit and tag `phase-4`.

---

## Phase 5: Polish

### Task 5.1: Offline

- [ ] `vite-plugin-pwa` with a precache of the app shell, fonts and the ice lesson, and runtime caching of each lesson's JSON and simulation chunk on first play. An "Available offline" marker in the object sheet.
- [ ] Playwright: play the ice lesson, go offline, reload, play it again and finish; the attempt queues.

### Task 5.2: Performance budget

- [ ] `scripts/check-budget.mjs` reads the Vite manifest and fails if the landing route's JavaScript exceeds 200 KB (the script reports raw and gzip sizes and enforces the limit on the raw total). Added to `pnpm build` in CI.

### Task 5.3: First-party analytics and the ops Analytics screen

- [ ] `services/analytics.ts` posts batched events (`lesson_started`, `step_completed`, `lesson_completed`, `hint_shown`) to `POST /events` with a profile ID only, never free text. No third-party scripts; a test scans the built HTML and JS for external origins and fails on any.
- [ ] `/ops/analytics`: active learners per day and week, lessons by subject, per-lesson step funnel, drawn with SVG.

### Task 5.4: Dark mode

- [ ] Dark values for every token, a theme toggle that defaults to the system setting, town and simulations reading tokens. A script checks every text and background token pair for 4.5:1. Screenshots of every screen in dark mode, read and fixed.

### Task 5.5: Narration and audio hooks

- [ ] Narration manifest and loader wired so that dropping `audio/<lineId>.mp3` files in place switches a line from speech synthesis to the recording. Sampler hook documented in `README.md`.

### Task 5.6: Final verification and report

- [ ] Run everything from a clean checkout: `pnpm install && pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`, then the API checks, then `docker compose up` and a manual pass through landing, sign-up, town, one lesson per subject, parent dashboard, teacher dashboard and ops console at 390 and 1440 px.
- [ ] Write `BUILD_REPORT.md`: what was built per phase, each acceptance line with the command or test that proves it, what is stubbed and why, what was not verified, every lesson's fact list for expert review, the open decisions, and how to run it.
- [ ] Commit and tag `phase-5`.

---

## Self-review

- **Spec coverage.** Sections 3 to 7 map to Phases 1 to 3; section 8 (ops console) to Tasks 3.8, 3.10, 4.8 and 5.3; section 9 (verification standard) to the fixtures in Task 1.10, applied in every later task; section 11 (stubs) to Tasks 3.6, 4.5, 5.5 and the report.
- **One gap closed during review.** The spec promises the same `next` rule on client and server; Task 3.4 now shares one fixture file between both test suites.
- **Names checked.** `LessonRuntime`, `EventBus`, `Simulation`, `resolveText`, `progress`, `objectStates`, `TutorProvider` and `AttemptRecord` are used with the same shapes wherever they appear.
