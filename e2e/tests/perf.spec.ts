import { expect, seed, test } from '../fixtures';
import { IceLesson } from './ice';

/**
 * Stands in for "60 fps on a mid-range Android phone": Chrome with the CPU slowed four times,
 * at phone size. Not a substitute for a real device, but it catches a simulation that is too heavy.
 */
test('simulations keep a smooth frame rate with the CPU throttled four times', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'perf',
    'runs alone in the perf project so other tests do not share the CPU',
  );
  test.slow();
  await seed(page);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const lesson = new IceLesson(page);
  await lesson.open();

  const measure = async (label: string) => {
    await page.evaluate(() => {
      (window as unknown as { __lumenFrames: number[] }).__lumenFrames = [];
    });
    await page.waitForTimeout(3000);
    const frames = await page.evaluate(() =>
      (window as unknown as { __lumenFrames: number[] }).__lumenFrames.slice(5),
    );
    const sorted = [...frames].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 999;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 999;
    info.annotations.push({
      type: 'frames',
      description: `${label}: median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, n=${frames.length}`,
    });
    expect(frames.length, `${label} produced frames`).toBeGreaterThan(60);
    expect(median, `${label} median frame time`).toBeLessThan(18);
    expect(p95, `${label} 95th percentile frame time`).toBeLessThan(34);
  };

  await lesson.continue();
  await lesson.drop('Coin', 'Cork', 'Ice cube', 'Apple');
  await measure('tank');
  await lesson.continue();
  await lesson.choice('bigger').click();
  await lesson.continue();
  await lesson.setTemperature(-10);
  await measure('molecules');
  await lesson.continue();
  await lesson.continue();
  await lesson.sortAll();
  await page.getByRole('button', { name: 'What if ice sank?' }).click();
  await measure('lake');
});
