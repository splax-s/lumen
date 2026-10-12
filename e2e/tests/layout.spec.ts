import { expectScreenIsSound, seed, test, type Depth } from '../fixtures';
import { IceLesson } from './ice';

/**
 * Every step of the lesson, at four widths and three depths, must fit the screen,
 * keep its controls large enough to tap, and pass the accessibility scan.
 */
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

for (const size of WIDTHS) {
  for (const depth of ['play', 'deep'] as Depth[]) {
    test(`ice lesson fits ${size.width}px at ${depth} depth`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'this test sets its own viewport');
      await page.setViewportSize(size);
      await seed(page, { depth });
      const lesson = new IceLesson(page);
      await lesson.open();
      await expectScreenIsSound(page);

      await lesson.continue();
      await lesson.drop('Coin', 'Cork', 'Ice cube', 'Apple');
      await expectScreenIsSound(page);

      await lesson.continue();
      await expectScreenIsSound(page);
      await lesson.choice('smaller').click();
      await lesson.choice('same').click();
      await page.getByRole('button', { name: 'Give me a hint' }).click();
      await expectScreenIsSound(page);
      await lesson.choice('bigger').click();
      await expectScreenIsSound(page);

      await lesson.continue();
      await lesson.setTemperature(-10);
      await expectScreenIsSound(page);

      await lesson.continue();
      await expectScreenIsSound(page);

      await lesson.continue();
      await lesson.sortButton('honey', 'Floats').click();
      await expectScreenIsSound(page);
      await lesson.sortAll();
      await page.getByRole('button', { name: 'What if ice sank?' }).click();
      await expectScreenIsSound(page);

      await lesson.continue();
      await expectScreenIsSound(page);
    });
  }
}

test('the lesson stays inside a very small phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'this test sets its own viewport');
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, { depth: 'deep' });
  const lesson = new IceLesson(page);
  await lesson.open();
  await expectScreenIsSound(page);
  await lesson.playTo('challenge');
  await expectScreenIsSound(page);
});
