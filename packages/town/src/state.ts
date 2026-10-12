import { SUBJECTS, type Subject } from '@lumen/engine';
import type { CatalogObject } from '@lumen/lessons';

/**
 * What each town object looks like for a learner, worked out from the lessons they have finished.
 * The API applies the same rule, and both are checked against the same fixtures.
 */

export type ObjectState = 'done' | 'next' | 'available' | 'locked' | 'soon';

const byNumber = (a: CatalogObject, b: CatalogObject) => (a.number ?? 999) - (b.number ?? 999);

/**
 * @param done finished lesson ids, oldest first (the last one is the most recent)
 */
export function objectStates(objects: CatalogObject[], done: readonly string[]): Record<string, ObjectState> {
  const finished = new Set(done);
  const states: Record<string, ObjectState> = {};
  const open: CatalogObject[] = [];

  for (const object of objects) {
    if (object.lesson === null) states[object.id] = 'soon';
    else if (finished.has(object.lesson)) states[object.id] = 'done';
    else if (object.needs.some((need) => !finished.has(need))) states[object.id] = 'locked';
    else {
      states[object.id] = 'available';
      open.push(object);
    }
  }

  open.sort(byNumber);
  if (open.length === 0) return states;

  const known = done.filter((id) => objects.some((o) => o.lesson === id));
  const last = known[known.length - 1];
  // First choice: whatever the lesson just finished leads to. Otherwise the earliest lesson not yet done.
  const primary = (last !== undefined && open.find((o) => o.needs.includes(last))) || open[0]!;
  states[primary.id] = 'next';

  // Second choice, once the learner has started: the earliest open lesson from a different subject.
  if (known.length > 0) {
    const secondary = open.find((o) => o.subject !== primary.subject);
    if (secondary) states[secondary.id] = 'next';
  }
  return states;
}

/** The unfinished prerequisite that keeps an object locked, if any. */
export function lockedBy(object: CatalogObject, done: readonly string[], all: CatalogObject[]): CatalogObject | null {
  const missing = object.needs.find((need) => !done.includes(need));
  if (missing === undefined) return null;
  return all.find((o) => o.lesson === missing) ?? null;
}

export function nextTag(done: readonly string[]): 'start' | 'next' {
  return done.length === 0 ? 'start' : 'next';
}

export function subjectProgress(
  objects: CatalogObject[],
  done: readonly string[],
): Record<Subject, { done: number; total: number }> {
  const out = Object.fromEntries(SUBJECTS.map((s) => [s, { done: 0, total: 0 }])) as Record<
    Subject,
    { done: number; total: number }
  >;
  for (const object of objects) {
    if (object.lesson === null) continue;
    out[object.subject].total += 1;
    if (done.includes(object.lesson)) out[object.subject].done += 1;
  }
  return out;
}
