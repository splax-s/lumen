import { catalog } from '@lumen/lessons';
import { lockedBy, nextTag, objectStates, subjectProgress, type ObjectState } from './state';

const objects = catalog.objects;
const states = (...done: string[]) => objectStates(objects, done);
const withState = (result: Record<string, ObjectState>, state: ObjectState) =>
  Object.keys(result).filter((id) => result[id] === state);

describe('town object states', () => {
  it('starts with only the glass marked next', () => {
    const result = states();
    expect(withState(result, 'next')).toEqual(['glass']);
    expect(result.kettle).toBe('locked');
    expect(result.swing).toBe('available');
    expect(withState(result, 'done')).toEqual([]);
  });

  it('paints the glass and marks the kettle next once the ice lesson is finished', () => {
    const result = states('chem.ice-floats');
    expect(result.glass).toBe('done');
    expect(result.kettle).toBe('next');
    expect(result['baking-soda']).toBe('locked');
  });

  it('never marks more than two objects next, and the second is from another subject', () => {
    const histories = [
      [],
      ['chem.ice-floats'],
      ['chem.ice-floats', 'phys.swing'],
      ['phys.swing', 'chem.ice-floats', 'chem.kettle-boil'],
      ['math.scale', 'bio.onion', 'music.guitar'],
    ];
    for (const done of histories) {
      const next = withState(objectStates(objects, done), 'next');
      expect(next.length).toBeGreaterThanOrEqual(1);
      expect(next.length).toBeLessThanOrEqual(2);
      const subjects = next.map((id) => objects.find((o) => o.id === id)!.subject);
      expect(new Set(subjects).size).toBe(next.length);
    }
  });

  it('follows the lesson just finished', () => {
    expect(states('chem.ice-floats', 'music.guitar').piano).toBe('next');
    expect(states('music.guitar', 'chem.ice-floats').kettle).toBe('next');
  });

  it('falls back to curriculum order when the last lesson has no successor', () => {
    const result = states('phys.swing');
    expect(result.glass).toBe('next');
  });

  it('always shows the radio dish as coming soon', () => {
    expect(states().dish).toBe('soon');
    expect(states(...objects.flatMap((o) => (o.lesson ? [o.lesson] : []))).dish).toBe('soon');
  });

  it('marks nothing next when every lesson is done', () => {
    const all = objects.flatMap((o) => (o.lesson ? [o.lesson] : []));
    const result = objectStates(objects, all);
    expect(withState(result, 'next')).toEqual([]);
    expect(withState(result, 'done')).toHaveLength(20);
  });

  it('ignores finished lessons it does not know', () => {
    expect(withState(states('chem.retired-lesson'), 'next')).toEqual(['glass']);
  });

  it('names what a locked object is waiting for', () => {
    const kettle = objects.find((o) => o.id === 'kettle')!;
    expect(lockedBy(kettle, [], objects)?.id).toBe('glass');
    expect(lockedBy(kettle, ['chem.ice-floats'], objects)).toBeNull();
  });

  it('says "Start here" before anything is done and "Next up" after', () => {
    expect(nextTag([])).toBe('start');
    expect(nextTag(['chem.ice-floats'])).toBe('next');
  });

  it('counts progress per subject out of four', () => {
    const counts = subjectProgress(objects, ['chem.ice-floats', 'chem.kettle-boil', 'phys.swing']);
    expect(counts.chemistry).toEqual({ done: 2, total: 4 });
    expect(counts.physics).toEqual({ done: 1, total: 4 });
    expect(counts.music).toEqual({ done: 0, total: 4 });
  });
});
