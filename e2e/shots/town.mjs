// Screenshots of the town. Usage: node shots/town.mjs <outDir>
import { chromium } from '@playwright/test';

const [outDir] = process.argv.slice(2);
const browser = await chromium.launch();
const seed = (d) => {
  const now = Date.now();
  const entries = d.map((lessonId, i) => ({ lessonId, at: now - (10 - i) * 1000 }));
  localStorage.setItem(
    'lumen.progress',
    JSON.stringify({
      version: 1,
      depth: 'play',
      narrate: false,
      done: entries,
      cards: entries,
      streak: { current: entries.length ? 3 : 0, longest: 3, lastDay: null, restDaysLeft: 2 },
      pendingAttempts: [],
    }),
  );
};
for (const [name, width, height, done] of [
  ['town-1440-fresh', 1440, 900, []],
  [
    'town-1440-progress',
    1440,
    900,
    ['chem.ice-floats', 'phys.swing', 'music.guitar', 'chem.kettle-boil'],
  ],
  ['town-390-fresh', 390, 844, []],
  ['town-768', 768, 1024, ['chem.ice-floats']],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(seed, done);
  await page.goto('http://localhost:4173/town');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  if (name === 'town-1440-progress') {
    await page.getByRole('button', { name: /Tiny particles/ }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/town-1440-thread.png` });
    await page.getByRole('button', { name: /Tiny particles/ }).click();
    await page.getByRole('button', { name: /^Kettle/ }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/town-1440-sheet.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Concept web' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/town-1440-web.png` });
  }
  if (name === 'town-390-fresh') {
    await page.getByRole('button', { name: /^Glass/ }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/town-390-sheet.png` });
  }
  console.log(
    name,
    JSON.stringify({
      errors,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    }),
  );
  await page.close();
}
await browser.close();
