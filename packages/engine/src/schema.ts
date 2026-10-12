import { z } from 'zod';
import { ConditionError, parseCondition } from './condition';

/**
 * The lesson file format. Every lesson is one YAML file that must satisfy this schema.
 * The step order is fixed: hook, poke, predict, zoom, name_it, challenge, keep.
 */

export const SUBJECTS = ['maths', 'physics', 'chemistry', 'biology', 'music'] as const;
export type Subject = (typeof SUBJECTS)[number];

export const STEP_ORDER = [
  'hook',
  'poke',
  'predict',
  'zoom',
  'name_it',
  'challenge',
  'keep',
] as const;
export type StepType = (typeof STEP_ORDER)[number];

const MAX_TITLE_WORDS = 12;

const moodSchema = z.enum(['happy', 'thinking', 'wow', 'proud']);

const depthFields = {
  play: z.string().min(1).optional(),
  explain: z.string().min(1).optional(),
  deep: z.string().min(1).optional(),
};

const needsPlayOrExplain = (value: { play?: string | undefined; explain?: string | undefined }) =>
  value.play !== undefined || value.explain !== undefined;
const playOrExplainMessage = { message: 'Text needs at least a Play or an Explain form' };

const depthObjectSchema = z
  .object(depthFields)
  .strict()
  .refine(needsPlayOrExplain, playOrExplainMessage);

/** A learner-facing string, written once or once per depth. */
export const depthTextSchema = z.union([z.string().min(1), depthObjectSchema]);

function wordCount(text: string): number {
  return text.replace(/\*/g, '').trim().split(/\s+/).filter(Boolean).length;
}

/** Text shown on screen outside Lumi's bubble: 12 words at most, at every depth. */
const screenTextSchema = depthTextSchema.superRefine((value, ctx) => {
  const forms = typeof value === 'string' ? [value] : [value.play, value.explain, value.deep];
  for (const form of forms) {
    if (form !== undefined && wordCount(form) > MAX_TITLE_WORDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `On-screen text is limited to ${MAX_TITLE_WORDS} words: "${form}"`,
      });
    }
  }
});

/** One thing Lumi says, with a mood. */
export const lumiLineSchema = z
  .object({ mood: moodSchema.optional(), ...depthFields })
  .strict()
  .refine(needsPlayOrExplain, playOrExplainMessage);

const simSpecSchema = z.object({ kind: z.string().min(1) }).passthrough();

const paramValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const sliderSchema = z
  .object({
    type: z.literal('slider'),
    param: z.string().min(1),
    label: screenTextSchema,
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    start: z.number(),
    unit: z.string().optional(),
    decimals: z.number().int().min(0).max(3).optional(),
  })
  .strict()
  .refine((s) => s.min < s.max && s.start >= s.min && s.start <= s.max, {
    message: 'Slider needs min < max and start within range',
  });

const optionSchema = z.object({ value: paramValueSchema, label: screenTextSchema }).strict();

const choiceControlSchema = z
  .object({
    type: z.literal('choice'),
    param: z.string().min(1),
    label: screenTextSchema,
    options: z.array(optionSchema).min(2).max(5),
    start: paramValueSchema,
  })
  .strict();

const buttonControlSchema = z
  .object({
    type: z.literal('button'),
    param: z.string().min(1),
    value: paramValueSchema.default(true),
    label: screenTextSchema,
  })
  .strict();

const toggleSideSchema = z
  .object({ value: paramValueSchema, label: screenTextSchema, lumi: lumiLineSchema.optional() })
  .strict();

const toggleSchema = z
  .object({ param: z.string().min(1), off: toggleSideSchema, on: toggleSideSchema })
  .strict();

const controlSchema = z.union([sliderSchema, choiceControlSchema, buttonControlSchema]);

const trayItemSchema = z
  .object({ id: z.string().min(1), label: screenTextSchema, icon: z.string().optional() })
  .strict();

const doneWhenSchema = z.string().superRefine((value, ctx) => {
  try {
    parseCondition(value);
  } catch (error) {
    const detail = error instanceof ConditionError ? error.message : String(error);
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `done_when does not parse: ${detail}` });
  }
});

/** Parts shared by every step that hosts a simulation the learner can touch. */
const interactiveFields = {
  title: screenTextSchema,
  sim: simSpecSchema,
  lumi: lumiLineSchema,
  goal: screenTextSchema.optional(),
  controls: z.array(controlSchema).max(4).optional(),
  tray: z.array(trayItemSchema).min(1).max(6).optional(),
  tray_param: z.string().optional(),
  toggle: toggleSchema.optional(),
  /** Lumi lines keyed by `event` or `event:value`. */
  reactions: z.record(lumiLineSchema).optional(),
  done_lumi: lumiLineSchema.optional(),
};

const hookSchema = z
  .object({ type: z.literal('hook'), ...interactiveFields, done_when: doneWhenSchema.optional() })
  .strict();

const pokeSchema = z
  .object({ type: z.literal('poke'), ...interactiveFields, done_when: doneWhenSchema })
  .strict();

const zoomSchema = z
  .object({ type: z.literal('zoom'), ...interactiveFields, done_when: doneWhenSchema })
  .strict();

const hintSchema = z
  .object({ ...depthFields, highlight: z.string().optional(), demo: simSpecSchema.optional() })
  .strict()
  .refine(needsPlayOrExplain, playOrExplainMessage);

const predictSchema = z
  .object({
    type: z.literal('predict'),
    title: screenTextSchema,
    lumi: lumiLineSchema,
    choices: z
      .array(
        z
          .object({ id: z.string().min(1), label: screenTextSchema, art: z.string().min(1) })
          .strict(),
      )
      .length(3),
    answer: z.string().min(1),
    /** Nudge, clue, then demo. */
    hints: z.array(hintSchema).min(2).max(3),
    /** Said when the ladder runs out and the answer is shown. */
    reveal: lumiLineSchema,
    correct: lumiLineSchema,
  })
  .strict()
  .superRefine((step, ctx) => {
    const ids = step.choices.map((c) => c.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choice ids must be unique',
        path: ['choices'],
      });
    }
    if (!ids.includes(step.answer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'answer must be one of the choices',
        path: ['answer'],
      });
    }
    step.hints.forEach((hint, index) => {
      if (hint.highlight !== undefined && !ids.includes(hint.highlight)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'highlight must be one of the choices',
          path: ['hints', index, 'highlight'],
        });
      }
    });
  });

const formulaSchema = z
  .object({
    lines: z.array(z.string()).default([]),
    table: z.array(z.tuple([z.string(), z.string()])).default([]),
    note: z.string().optional(),
  })
  .strict();

const nameItSchema = z
  .object({
    type: z.literal('name_it'),
    /** Wrap the new term in asterisks to highlight it: "Ice is less *dense* than water." */
    title: screenTextSchema,
    term: z.string().min(1),
    body: depthTextSchema,
    /** Shown at Deep only. */
    formula: formulaSchema.optional(),
    lumi: lumiLineSchema,
    sim: simSpecSchema.optional(),
  })
  .strict();

const sortSchema = z
  .object({
    bins: z.array(z.object({ id: z.string().min(1), label: screenTextSchema }).strict()).length(2),
    items: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: screenTextSchema,
            /** Shown at Explain and Deep, for example a density. */
            detail: z.string().optional(),
            icon: z.string().optional(),
            bin: z.string().min(1),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    /** May use {name} and {detail}. */
    not_quite: lumiLineSchema,
    done: lumiLineSchema,
  })
  .strict()
  .superRefine((sort, ctx) => {
    const bins = sort.bins.map((b) => b.id);
    sort.items.forEach((item, index) => {
      if (!bins.includes(item.bin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'bin must be one of the bins',
          path: ['items', index, 'bin'],
        });
      }
    });
  });

const thenSchema = z
  .object({
    title: screenTextSchema.optional(),
    sim: simSpecSchema,
    lumi: lumiLineSchema.optional(),
    goal: screenTextSchema.optional(),
    controls: z.array(controlSchema).max(4).optional(),
    tray: z.array(trayItemSchema).min(1).max(6).optional(),
    tray_param: z.string().optional(),
    toggle: toggleSchema.optional(),
    reactions: z.record(lumiLineSchema).optional(),
    done_when: doneWhenSchema.optional(),
    done_lumi: lumiLineSchema.optional(),
  })
  .strict()
  .refine((then) => then.toggle !== undefined || then.done_when !== undefined, {
    message: 'A challenge follow-up needs a toggle or a done_when',
  });

const challengeSchema = z
  .object({
    type: z.literal('challenge'),
    title: screenTextSchema,
    lumi: lumiLineSchema,
    sort: sortSchema.optional(),
    /** A puzzle or a "what if" twist inside a simulation. */
    then: thenSchema.optional(),
  })
  .strict()
  .refine((step) => step.sort !== undefined || step.then !== undefined, {
    message: 'A challenge needs a sort, a simulation puzzle, or both',
  });

const keepSchema = z
  .object({
    type: z.literal('keep'),
    lumi: lumiLineSchema,
    where_else: z
      .array(
        z
          .object({
            title: z.string().min(1),
            text: depthTextSchema,
            lesson: z.string().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();

export const stepSchema = z.union([
  hookSchema,
  pokeSchema,
  predictSchema,
  zoomSchema,
  nameItSchema,
  challengeSchema,
  keepSchema,
]);

const WRONG = /\bwrong\b/i;

function findWrong(value: unknown, path: (string | number)[], out: (string | number)[][]): void {
  if (typeof value === 'string') {
    if (WRONG.test(value)) out.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => findWrong(item, [...path, index], out));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'done_when' || key === 'source') continue;
      findWrong(item, [...path, key], out);
    }
  }
}

export const lessonSchema = z
  .object({
    id: z.string().regex(/^[a-z]+\.[a-z0-9-]+$/, 'Lesson ids look like "chem.ice-floats"'),
    /** Position in the launch curriculum, 1 to 20. */
    number: z.number().int().min(1),
    version: z.number().int().min(1).default(1),
    title: screenTextSchema,
    subject: z.enum(SUBJECTS),
    /** place/object in the town, for example "kitchen/glass". */
    object: z.string().regex(/^[a-z-]+\/[a-z-]+$/),
    threads: z.array(z.string().min(1)).min(1),
    needs: z.array(z.string()),
    concepts: z.array(z.string().min(1)).min(1),
    /** The takeaway card. */
    card: z.string().min(1),
    summary: depthTextSchema,
    /** One line for the town: what you will play with. */
    blurb: z.string().min(1),
    minutes: z.number().int().min(1).max(15).default(5),
    /** The accuracy reference the tutor must stay consistent with. */
    facts: z
      .array(z.object({ text: z.string().min(1), source: z.string().min(1) }).strict())
      .min(1),
    /** Scripted answers Lumi can give with no model call. */
    questions: z
      .array(z.object({ ask: depthTextSchema, answer: depthTextSchema }).strict())
      .default([]),
    /** Wrong predict choices mapped to the misunderstanding behind them. */
    misconceptions: z
      .array(
        z
          .object({ choice: z.string(), text: depthTextSchema, lesson: z.string().optional() })
          .strict(),
      )
      .default([]),
    tags: z.array(z.string()).default([]),
    steps: z.array(stepSchema).length(STEP_ORDER.length),
  })
  .strict()
  .superRefine((lesson, ctx) => {
    const order = lesson.steps.map((s) => s.type).join(', ');
    if (order !== STEP_ORDER.join(', ')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Steps must be in the order ${STEP_ORDER.join(', ')} (got ${order})`,
        path: ['steps'],
      });
    }
    const hits: (string | number)[][] = [];
    findWrong(lesson, [], hits);
    for (const path of hits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Lumi says "not quite", never "wrong"',
        path,
      });
    }
  });

export type Lesson = z.infer<typeof lessonSchema>;
export type Step = Lesson['steps'][number];
export type HookStep = Extract<Step, { type: 'hook' }>;
export type PokeStep = Extract<Step, { type: 'poke' }>;
export type PredictStep = Extract<Step, { type: 'predict' }>;
export type ZoomStep = Extract<Step, { type: 'zoom' }>;
export type NameItStep = Extract<Step, { type: 'name_it' }>;
export type ChallengeStep = Extract<Step, { type: 'challenge' }>;
export type KeepStep = Extract<Step, { type: 'keep' }>;
export type InteractiveStep = HookStep | PokeStep | ZoomStep;
export type ThenStage = NonNullable<ChallengeStep['then']>;
export type LumiLine = z.infer<typeof lumiLineSchema>;
export type Hint = PredictStep['hints'][number];
export type Control = NonNullable<InteractiveStep['controls']>[number];
export type SliderControl = Extract<Control, { type: 'slider' }>;
export type ChoiceControl = Extract<Control, { type: 'choice' }>;
export type ButtonControl = Extract<Control, { type: 'button' }>;
export type Toggle = NonNullable<InteractiveStep['toggle']>;
export type TrayItem = NonNullable<InteractiveStep['tray']>[number];
export type SimSpec = z.infer<typeof simSpecSchema>;
export type ParamValue = z.infer<typeof paramValueSchema>;
