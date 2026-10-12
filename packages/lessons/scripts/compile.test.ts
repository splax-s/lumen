import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { lessonFixture } from '../../engine/src/schema.fixture';
import { compile } from './compile';

const CATALOG = `
places: { kitchen: Kitchen }
subjects: { chemistry: Chemistry }
threads:
  - { id: particles, name: Tiny particles, objects: [glass, kettle] }
objects:
  - { id: glass, name: Glass, lesson: chem.ice-floats, number: 1, subject: chemistry, place: kitchen, question: "Why does ice float?", blurb: b, needs: [] }
  - { id: kettle, name: Kettle, lesson: chem.kettle-boil, number: 2, subject: chemistry, place: kitchen, question: "Where does boiling water go?", blurb: b, needs: [chem.ice-floats] }
`;

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function project(change?: (lesson: Any) => void, catalog = CATALOG) {
  const dir = mkdtempSync(join(tmpdir(), 'lumen-lessons-'));
  mkdirSync(join(dir, 'content', 'chemistry'), { recursive: true });
  const lesson = lessonFixture() as Any;
  change?.(lesson);
  writeFileSync(join(dir, 'content', 'chemistry', 'ice-floats.yaml'), stringify(lesson));
  writeFileSync(join(dir, 'catalog.yaml'), catalog);
  return compile({ contentDir: join(dir, 'content'), catalogPath: join(dir, 'catalog.yaml') });
}

describe('lesson compiler', () => {
  it('compiles a valid lesson and marks its object as built', () => {
    const result = project();
    expect(result.errors).toEqual([]);
    expect(result.lessons.map((l) => l.id)).toEqual(['chem.ice-floats']);
    const glass = result.catalog.objects.find((o) => o.id === 'glass')!;
    expect(glass).toMatchObject({
      built: true,
      card: 'Ice floats because freezing water spreads out.',
      threads: ['particles'],
    });
    expect(result.catalog.objects.find((o) => o.id === 'kettle')).toMatchObject({
      built: false,
      card: null,
    });
  });

  it('names the file when a done_when does not parse', () => {
    const result = project((l) => (l.steps[1].done_when = 'count('));
    expect(result.errors.join('\n')).toMatch(/ice-floats\.yaml.*steps\.1\.done_when/s);
  });

  it('rejects a simulation kind the engine does not have', () => {
    const result = project((l) => (l.steps[0].sim.kind = 'volcano'));
    expect(result.errors.join('\n')).toMatch(/Unknown simulation "volcano"/);
  });

  it('rejects a lesson the catalog does not list', () => {
    const result = project((l) => (l.id = 'chem.mystery'));
    expect(result.errors.join('\n')).toMatch(/not in catalog/);
  });

  it.each([
    ['subject', (l: Any) => (l.subject = 'physics'), /subject/],
    ['prerequisites', (l: Any) => (l.needs = ['chem.kettle-boil']), /needs/],
    ['threads', (l: Any) => (l.threads = ['waves']), /threads/],
    ['title', (l: Any) => (l.title = 'Why does ice sink?'), /title/],
    ['number', (l: Any) => (l.number = 4), /number/],
    ['object', (l: Any) => (l.object = 'kitchen/kettle'), /object/],
  ])('rejects a lesson whose %s disagrees with the catalog', (_name, change, pattern) => {
    expect(project(change).errors.join('\n')).toMatch(pattern);
  });

  it('rejects a where-else link to a lesson that does not exist', () => {
    const result = project((l) => (l.steps[6].where_else[0].lesson = 'chem.nowhere'));
    expect(result.errors.join('\n')).toMatch(/where_else.*chem\.nowhere/s);
  });

  it('rejects a catalog thread that names a missing object', () => {
    const result = project(undefined, CATALOG.replace('[glass, kettle]', '[glass, teapot]'));
    expect(result.errors.join('\n')).toMatch(/teapot/);
  });

  it('rejects a catalog object that belongs to no thread', () => {
    const result = project(undefined, CATALOG.replace('[glass, kettle]', '[glass]'));
    expect(result.errors.join('\n')).toMatch(/kettle.*thread/s);
  });

  it('rejects malformed YAML with the file name', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lumen-lessons-'));
    mkdirSync(join(dir, 'content'), { recursive: true });
    writeFileSync(join(dir, 'content', 'bad.yaml'), 'id: [unclosed');
    writeFileSync(join(dir, 'catalog.yaml'), CATALOG);
    const result = compile({
      contentDir: join(dir, 'content'),
      catalogPath: join(dir, 'catalog.yaml'),
    });
    expect(result.errors.join('\n')).toMatch(/bad\.yaml/);
  });

  it('the real catalog and lessons compile cleanly', () => {
    const root = join(__dirname, '..');
    const result = compile({
      contentDir: join(root, 'content'),
      catalogPath: join(root, 'catalog.yaml'),
    });
    expect(result.errors).toEqual([]);
    expect(result.catalog.objects).toHaveLength(21);
    const raw = parse(readFileSync(join(root, 'catalog.yaml'), 'utf8')) as Any;
    expect(raw.objects.filter((o: Any) => o.lesson).length).toBe(20);
  });
});
