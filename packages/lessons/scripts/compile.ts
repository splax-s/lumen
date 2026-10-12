import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { lessonSchema, SIM_KINDS, SUBJECTS, type Lesson, type Subject } from '@lumen/engine';

/** Reads the catalog and every lesson file, checks them against each other, and returns the compiled data. */

export type CatalogObject = {
  id: string;
  name: string;
  /** null for objects whose lesson comes in a later release. */
  lesson: string | null;
  number: number | null;
  subject: Subject;
  place: string;
  question: string;
  blurb: string;
  needs: string[];
  threads: string[];
  /** A playable lesson file exists. */
  built: boolean;
  card: string | null;
  concepts: string[];
  minutes: number;
};

export type CatalogThread = { id: string; name: string; objects: string[] };

export type Catalog = {
  places: Record<string, string>;
  subjects: Record<Subject, string>;
  threads: CatalogThread[];
  objects: CatalogObject[];
};

export type CompileResult = { errors: string[]; lessons: Lesson[]; catalog: Catalog };

type RawObject = Omit<CatalogObject, 'threads' | 'built' | 'card' | 'concepts' | 'minutes'>;
type RawCatalog = { places: Record<string, string>; subjects: Record<Subject, string>; threads: CatalogThread[]; objects: RawObject[] };

function yamlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...yamlFiles(path));
    else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) out.push(path);
  }
  return out;
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
}

function simKinds(lesson: Lesson): { kind: string; path: string }[] {
  const found: { kind: string; path: string }[] = [];
  lesson.steps.forEach((step, index) => {
    if ('sim' in step && step.sim) found.push({ kind: step.sim.kind, path: `steps.${index}.sim` });
    if (step.type === 'predict') {
      step.hints.forEach((hint, h) => {
        if (hint.demo) found.push({ kind: hint.demo.kind, path: `steps.${index}.hints.${h}.demo` });
      });
    }
    if (step.type === 'challenge' && step.then) {
      found.push({ kind: step.then.sim.kind, path: `steps.${index}.then.sim` });
    }
  });
  return found;
}

export function compile(options: { contentDir: string; catalogPath: string }): CompileResult {
  const errors: string[] = [];
  const raw = parse(readFileSync(options.catalogPath, 'utf8')) as RawCatalog;
  const objectIds = new Set(raw.objects.map((o) => o.id));
  const lessonIds = new Set(raw.objects.map((o) => o.lesson).filter((id): id is string => id !== null));

  for (const thread of raw.threads) {
    for (const id of thread.objects) {
      if (!objectIds.has(id)) errors.push(`catalog.yaml: thread "${thread.id}" names missing object "${id}"`);
    }
  }
  for (const object of raw.objects) {
    if (!SUBJECTS.includes(object.subject)) errors.push(`catalog.yaml: object "${object.id}" has unknown subject`);
    if (!(object.place in raw.places)) errors.push(`catalog.yaml: object "${object.id}" has unknown place`);
    if (!raw.threads.some((t) => t.objects.includes(object.id))) {
      errors.push(`catalog.yaml: object "${object.id}" belongs to no thread`);
    }
    for (const need of object.needs) {
      if (!lessonIds.has(need)) errors.push(`catalog.yaml: object "${object.id}" needs missing lesson "${need}"`);
    }
  }

  const lessons: Lesson[] = [];
  for (const file of yamlFiles(options.contentDir)) {
    const name = relative(options.contentDir, file);
    let data: unknown;
    try {
      data = parse(readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(`${name}: ${(error as Error).message.split('\n')[0]}`);
      continue;
    }
    const parsed = lessonSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${name}: ${issue.path.join('.')}: ${issue.message}`);
      continue;
    }
    const lesson = parsed.data;
    const object = raw.objects.find((o) => o.lesson === lesson.id);
    if (!object) {
      errors.push(`${name}: lesson "${lesson.id}" is not in catalog.yaml`);
      continue;
    }
    if (lessons.some((l) => l.id === lesson.id)) errors.push(`${name}: duplicate lesson id "${lesson.id}"`);
    const threads = raw.threads.filter((t) => t.objects.includes(object.id)).map((t) => t.id);
    const expect = (field: string, ok: boolean, wanted: unknown) => {
      if (!ok) errors.push(`${name}: ${field} disagrees with catalog.yaml (expected ${JSON.stringify(wanted)})`);
    };
    expect('subject', lesson.subject === object.subject, object.subject);
    expect('object', lesson.object === `${object.place}/${object.id}`, `${object.place}/${object.id}`);
    expect('number', lesson.number === object.number, object.number);
    expect('title', lesson.title === object.question, object.question);
    expect('needs', sameSet(lesson.needs, object.needs), object.needs);
    expect('threads', sameSet(lesson.threads, threads), threads);
    for (const { kind, path } of simKinds(lesson)) {
      if (!SIM_KINDS.includes(kind)) errors.push(`${name}: ${path}: Unknown simulation "${kind}"`);
    }
    const keep = lesson.steps[lesson.steps.length - 1];
    if (keep?.type === 'keep') {
      keep.where_else.forEach((entry, index) => {
        if (entry.lesson !== undefined && !lessonIds.has(entry.lesson)) {
          errors.push(`${name}: where_else.${index}: lesson "${entry.lesson}" does not exist`);
        }
      });
    }
    for (const entry of lesson.misconceptions) {
      if (entry.lesson !== undefined && !lessonIds.has(entry.lesson)) {
        errors.push(`${name}: misconceptions: lesson "${entry.lesson}" does not exist`);
      }
    }
    lessons.push(lesson);
  }

  lessons.sort((a, b) => a.number - b.number);
  const catalog: Catalog = {
    places: raw.places,
    subjects: raw.subjects,
    threads: raw.threads,
    objects: raw.objects.map((object) => {
      const lesson = lessons.find((l) => l.id === object.lesson);
      return {
        ...object,
        threads: raw.threads.filter((t) => t.objects.includes(object.id)).map((t) => t.id),
        built: lesson !== undefined,
        card: lesson?.card ?? null,
        concepts: lesson?.concepts ?? [],
        minutes: lesson?.minutes ?? 5,
      };
    }),
  };
  return { errors, lessons, catalog };
}
