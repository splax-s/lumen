// Walks the ice lesson and saves a screenshot of every step. Usage: node shots/walk.mjs <outDir> <width> <height> [depth]
import { chromium } from '@playwright/test';

const [outDir, width = '1280', height = '800', depth = 'play'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +width, height: +height }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript((d) => {
  localStorage.setItem('lumen.progress', JSON.stringify({ version: 1, depth: d, narrate: false, done: [], cards: [], streak: { current: 0, longest: 0, lastDay: null, restDaysLeft: 2 }, pendingAttempts: [] }));
}, depth);
await page.goto('http://localhost:4173/lesson/chem.ice-floats');
const tag = `${width}-${depth}`;
const shot = (name) => page.screenshot({ path: `${outDir}/${tag}-${name}.png` });
const next = async () => {
  const b = page.locator('footer button').last();
  await b.waitFor();
  await page.waitForFunction(() => !document.querySelector('footer button:last-of-type')?.disabled, null, { timeout: 15000 });
  await b.click();
  await page.waitForTimeout(400);
};
await page.waitForTimeout(1500);
await shot('1-hook');
await next();
for (const item of ['Coin', 'Cork', 'Ice cube', 'Apple']) {
  await page.getByRole('button', { name: item, exact: true }).click();
  await page.waitForTimeout(300);
}
await page.waitForTimeout(4000);
await shot('2-poke');
await next();
await shot('3-predict');
await page.locator('[data-choice=smaller]').click();
await page.locator('[data-choice=same]').click();
await page.getByRole('button', { name: 'Give me a hint' }).click();
await page.waitForTimeout(1500);
await shot('3-predict-demo');
await page.locator('[data-choice=bigger]').click();
await page.waitForTimeout(300);
await shot('3-predict-solved');
await next();
await page.waitForTimeout(800);
await shot('4-zoom-liquid');
await page.getByRole('slider').fill('-6');
await page.waitForTimeout(3500);
await shot('4-zoom-ice');
await next();
await shot('5-name');
await next();
await shot('6-challenge');
for (const [item, bin] of [['log', 'Floats'], ['stone', 'Sinks'], ['iceberg', 'Sinks'], ['iceberg', 'Floats'], ['bolt', 'Sinks'], ['oil', 'Floats'], ['honey', 'Sinks']]) {
  await page.locator(`[data-item=${item}]`).getByRole('button', { name: new RegExp(bin) }).click();
}
await page.waitForTimeout(3500);
await shot('6-challenge-lake');
await page.getByRole('button', { name: 'What if ice sank?' }).click();
await page.waitForTimeout(6000);
await shot('6-challenge-sank');
await next();
await shot('7-keep');
console.log(JSON.stringify({ tag, errors, overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) }));
await browser.close();
