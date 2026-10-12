import { expect, expectScreenIsSound, seed, test } from '../fixtures';
import { IceLesson } from './ice';

const object = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-object="${id}"]`).first();

test('a new learner sees a sketched town with the glass marked as the place to start', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/town');
  await expect(page.getByRole('heading', { level: 1, name: 'Your town' })).toBeVisible();
  await expect(page.locator('[data-object]')).toHaveCount(21);
  await expect(object(page, 'glass')).toHaveAttribute('data-state', 'next');
  await expect(object(page, 'glass')).toContainText('Start here');
  await expect(object(page, 'kettle')).toHaveAttribute('data-state', 'locked');
  await expect(object(page, 'dish')).toHaveAttribute('data-state', 'soon');
  await expect(page.locator('[data-state="done"]')).toHaveCount(0);
  await expect(page.getByTestId('lumi-text')).toHaveText(/Tap the glass of ice water/);
  await expect(page.getByText('Finish a lesson to earn your first card.')).toBeVisible();
  await expect(page.getByText('Chemistry 0/4')).toBeVisible();
});

test('finishing the ice lesson paints the glass and marks the kettle as next', async ({ page }) => {
  await seed(page);
  await page.goto('/town');
  await object(page, 'glass').click();
  const sheet = page.getByRole('dialog', { name: 'Why does ice float?' });
  await expect(sheet).toContainText('Chemistry · Kitchen');
  await expect(sheet).toContainText('Drop things into water');
  await expect(sheet).toContainText('About 5 minutes');
  await sheet.getByRole('button', { name: 'Start lesson' }).click();

  const lesson = new IceLesson(page);
  await expect(lesson.heading('Why does ice float?')).toBeVisible();
  await lesson.playTo('keep');
  await lesson.continue();

  await expect(page).toHaveURL(/\/town$/);
  await expect(object(page, 'glass')).toHaveAttribute('data-state', 'done');
  await expect(object(page, 'kettle')).toHaveAttribute('data-state', 'next');
  await expect(object(page, 'kettle')).toContainText('Next up');
  await expect(object(page, 'glass')).toBeInViewport();
  // Painted: the ice in the glass now has its real colour instead of paper white.
  const fill = await object(page, 'glass')
    .locator('rect.f')
    .first()
    .evaluate((el) => getComputedStyle(el).fill);
  expect(fill).toBe('rgb(227, 245, 255)');
  await expect(page.getByText('Chemistry 1/4')).toBeVisible();
  await expect(page.getByText('1-day streak')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your cards · 1' })).toBeVisible();
  await expect(page.getByText('Ice floats because freezing water spreads out.')).toBeVisible();

  // Still there after a reload, and the lesson can be replayed.
  await page.reload();
  await expect(object(page, 'glass')).toHaveAttribute('data-state', 'done');
  await object(page, 'glass').click();
  await expect(page.getByRole('dialog')).toContainText('Lit up');
  await expect(page.getByRole('button', { name: 'Play again' })).toBeEnabled();
});

test('a locked object says what opens it, and cannot be started', async ({ page }) => {
  await seed(page);
  await page.goto('/town');
  await object(page, 'kettle').click();
  const sheet = page.getByRole('dialog', { name: 'Where does boiling water go?' });
  await expect(sheet).toContainText('Opens after: Why does ice float?');
  await expect(sheet.locator('button').last()).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await object(page, 'dish').click();
  await expect(page.getByRole('dialog')).toContainText('Coming soon');
});

test('thread chips draw a path through their objects and dim the rest', async ({ page }) => {
  await seed(page);
  await page.goto('/town');
  const chip = page.getByRole('button', { name: /Tiny particles/ });
  await expect(page.locator('path[class*="thread"]')).toHaveCount(0);
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('path[class*="thread"]')).toHaveCount(1);
  const opacity = (id: string) =>
    object(page, id).evaluate((el) => Number(getComputedStyle(el).opacity));
  await expect.poll(() => opacity('swing')).toBeLessThan(0.3);
  expect(await opacity('glass')).toBe(1);
  expect(await opacity('kettle')).toBe(1);
  expect(await opacity('gate')).toBe(1);
  await expect(page.getByTestId('lumi-text')).toHaveText(/dotted path/);

  await page.getByRole('button', { name: /Waves/ }).click();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => opacity('guitar')).toBe(1);
  await expect.poll(() => opacity('glass')).toBeLessThan(0.3);

  await page.getByRole('button', { name: /Waves/ }).click();
  await expect(page.locator('path[class*="thread"]')).toHaveCount(0);
  await expect.poll(() => opacity('glass')).toBe(1);

  // A thread can also be chosen from an object's sheet.
  await object(page, 'sunflower').click();
  await page.getByRole('button', { name: /Thread: Patterns/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Patterns/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('on a phone the town scrolls sideways inside its frame and the page does not', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'phone layout only');
  await seed(page);
  await page.goto('/town');
  const frame = page.locator('[data-scroll-x]');
  const sizes = await frame.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(sizes.scroll).toBeGreaterThanOrEqual(880);
  expect(sizes.client).toBeLessThanOrEqual(390);
  const page0 = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    view: window.innerWidth,
  }));
  expect(page0.doc).toBeLessThanOrEqual(page0.view);

  // The playground starts off screen; scrolling the frame brings it in.
  await expect(object(page, 'swing')).not.toBeInViewport();
  await frame.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect(object(page, 'seesaw')).toBeInViewport();
  await object(page, 'seesaw').click();
  await expect(
    page.getByRole('dialog', { name: 'How can a child lift a grown-up?' }),
  ).toBeVisible();
});

test('the town works with the keyboard: open an object, stay in the sheet, close, and return', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'keyboard is checked on the desktop layout');
  await seed(page);
  await page.goto('/town');
  await object(page, 'glass').focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Start lesson' })).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(object(page, 'glass')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Start lesson' }).press('Enter');
  await expect(page).toHaveURL(/\/lesson\/chem\.ice-floats/);
});

test('the concept web shows the same lessons and states, and remembers the choice', async ({
  page,
}) => {
  await seed(page, { done: ['chem.ice-floats'] });
  await page.goto('/town');
  await page.getByRole('button', { name: 'Concept web' }).click();
  await expect(page.locator('[data-object]')).toHaveCount(20);
  await expect(object(page, 'glass')).toHaveAttribute('data-state', 'done');
  await expect(object(page, 'kettle')).toHaveAttribute('data-state', 'next');
  await object(page, 'kettle').click();
  await expect(page.getByRole('dialog', { name: 'Where does boiling water go?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Concept web' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Town', exact: true }).click();
  await expect(page.locator('[data-object]')).toHaveCount(21);
});

test('the daily challenge asks one question and remembers it was answered', async ({ page }) => {
  await seed(page, { done: ['chem.ice-floats'] });
  await page.goto('/town');
  const daily = page.getByRole('region', { name: /freeze it\. What happens\?/ });
  await daily.getByRole('button', { name: 'It stays the same' }).click();
  await expect(daily).toContainText('Not quite');
  await expect(daily.getByRole('button', { name: 'It stays the same' })).toBeDisabled();
  await daily.getByRole('button', { name: 'The ice takes up more space' }).click();
  await expect(daily).toContainText('Done for today');
  await page.reload();
  await expect(page.getByRole('region', { name: /freeze it/ })).toContainText('Done for today');
});

test('progress can be reset, but only after confirming', async ({ page }) => {
  await seed(page, { done: ['chem.ice-floats'] });
  await page.goto('/town');
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('button', { name: 'Keep my progress' }).click();
  await expect(object(page, 'glass')).toHaveAttribute('data-state', 'done');
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('button', { name: 'Yes, reset' }).click();
  await expect(object(page, 'glass')).toHaveAttribute('data-state', 'next');
  await expect(page.getByRole('button', { name: 'Reset progress' })).toBeDisabled();
});

test('the town still works when the browser refuses storage', async ({ page }) => {
  await page.addInitScript(() => {
    const refuse = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', {
      get: () => ({ getItem: refuse, setItem: refuse, removeItem: refuse }),
    });
  });
  await page.goto('/town');
  await expect(object(page, 'glass')).toHaveAttribute('data-state', 'next');
  await object(page, 'glass').click();
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Why does ice float?' })).toBeVisible();
});

for (const size of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`the town fits ${size.width}px, with a sheet open and in the concept web`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'this test sets its own viewport');
    await page.setViewportSize(size);
    await seed(page, { done: ['chem.ice-floats'] });
    await page.goto('/town');
    await expect(object(page, 'glass')).toBeVisible();
    await expectScreenIsSound(page);
    await page.getByRole('button', { name: /Living things/ }).click();
    await expectScreenIsSound(page);
    await object(page, 'kettle').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectScreenIsSound(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Concept web' }).click();
    await expectScreenIsSound(page);
  });
}
