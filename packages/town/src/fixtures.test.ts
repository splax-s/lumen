import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalog } from '@lumen/lessons';
import { objectStates } from './state';

/**
 * The web app and the API both work out town object states. This file pins the answers for a
 * set of learner histories, and the API's tests read the same file, so the two cannot drift.
 * Regenerate with: UPDATE_FIXTURES=1 pnpm --filter @lumen/town test
 */
const FIXTURE = join(__dirname, '../../lessons/fixtures/town-states.json');

const all = catalog.objects.flatMap((o) => (o.lesson ? [o.lesson] : []));
const HISTORIES: string[][] = [
  [],
  ['chem.ice-floats'],
  ['chem.ice-floats', 'chem.kettle-boil'],
  ['phys.swing'],
  ['chem.ice-floats', 'phys.swing'],
  ['phys.swing', 'chem.ice-floats'],
  ['music.guitar', 'chem.ice-floats', 'music.piano'],
  ['math.scale', 'bio.onion', 'phys.telescope'],
  ['chem.ice-floats', 'chem.kettle-boil', 'chem.baking-soda', 'chem.rust'],
  ['chem.retired-lesson'],
  ['chem.ice-floats', 'chem.retired-lesson'],
  all.slice(0, 10),
  all.slice(0, 19),
  all,
];

describe('shared town-state fixtures', () => {
  const computed = HISTORIES.map((done) => ({ done, states: objectStates(catalog.objects, done) }));

  it('match the rule in this package', () => {
    if (process.env.UPDATE_FIXTURES || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, `${JSON.stringify(computed, null, 2)}\n`);
    }
    expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(computed);
  });
});
