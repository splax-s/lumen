import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from './compile';

/** Validates every lesson and writes the compiled JSON the web app and the API load. */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const result = compile({ contentDir: join(root, 'content'), catalogPath: join(root, 'catalog.yaml') });

if (result.errors.length > 0) {
  console.error(`Lesson build failed with ${result.errors.length} problem(s):\n`);
  for (const error of result.errors) console.error(`  ${error}`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'lessons'), { recursive: true });
for (const lesson of result.lessons) {
  writeFileSync(join(out, 'lessons', `${lesson.id}.json`), JSON.stringify(lesson));
}
writeFileSync(join(out, 'catalog.json'), JSON.stringify(result.catalog, null, 2));
// One file with everything, for the API's lesson sync and the tutor's fact sheets.
writeFileSync(join(out, 'lessons.json'), JSON.stringify(result.lessons));
console.log(`Built ${result.lessons.length} lesson(s), ${result.catalog.objects.length} town objects.`);
