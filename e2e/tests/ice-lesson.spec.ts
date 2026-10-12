import { expect, seed, test, type Depth } from '../fixtures';
import { IceLesson } from './ice';

const TEXT: Record<
  Depth,
  { hook: RegExp; iceLabel: RegExp; frozen: RegExp; sortDetail: boolean; formula: boolean }
> = {
  play: {
    hook: /Ice is hard like a stone/,
    iceLabel: /most of it is hiding underwater/,
    frozen: /hold hands in rings/,
    sortDetail: false,
    formula: false,
  },
  explain: {
    hook: /Most solids sink in their own liquid/,
    iceLabel: /about 92% of it stays underwater/,
    frozen: /six-sided rings held by hydrogen bonds/,
    sortDetail: true,
    formula: false,
  },
  deep: {
    hook: /Water is a rare exception/,
    iceLabel: /Ice is 0\.92 g\/cm³/,
    frozen: /hexagonal lattice \(ice Ih\)/,
    sortDetail: true,
    formula: true,
  },
};

for (const depth of ['play', 'explain', 'deep'] as const) {
  test(`the whole lesson plays at ${depth} depth`, async ({ page }) => {
    await seed(page, { depth });
    const lesson = new IceLesson(page);
    await lesson.open();
    const expected = TEXT[depth];

    // 1. Hook: ice floats next to a sunken stone, with the simulation already running.
    await lesson.expectStep(1);
    await expect(lesson.lumi).toHaveText(expected.hook);
    await expect(lesson.sim('tank')).toHaveAttribute(
      'aria-label',
      /ice cube floats with 92% of it under water/,
    );
    await expect(lesson.sim('tank')).toHaveAttribute('aria-label', /stone has sunk to the bottom/);
    await lesson.continue();

    // 2. Poke: continue only after three things are in, including the ice.
    await lesson.expectStep(2);
    await expect(lesson.heading('Sink or float?')).toBeVisible();
    await expect(lesson.continueButton).toBeDisabled();
    await lesson.drop('Coin', 'Cork', 'Apple');
    await expect(lesson.sim('tank')).toHaveAttribute(
      'aria-label',
      /apple floats with 80% of it under water/,
    );
    await expect(lesson.sim('tank')).toHaveAttribute(
      'aria-label',
      /cork floats with 24% of it under water/,
    );
    await expect(lesson.sim('tank')).toHaveAttribute('aria-label', /coin has sunk/);
    await expect(lesson.continueButton, 'three items without ice is not enough').toBeDisabled();
    await lesson.drop('Ice cube');
    await expect(lesson.lumi).toHaveText(expected.iceLabel);
    await expect(page.getByRole('button', { name: 'Ice cube', exact: true })).toBeDisabled();
    await lesson.continue();

    // 3. Predict.
    await lesson.expectStep(3);
    await expect(lesson.heading(/freeze it\. What happens\?/)).toBeVisible();
    await expect(lesson.continueButton).toBeDisabled();
    await expect(lesson.continueButton).toHaveText('Pick an answer');
    await lesson.choice('bigger').click();
    await expect(lesson.lumi).toHaveText(/freez/i);
    await lesson.continue();

    // 4. Zoom in: about 48 molecules; freezing shows 109%.
    await lesson.expectStep(4);
    await expect(lesson.sim('molecules')).toHaveAttribute('aria-label', /Space taken: 100%/);
    await expect(lesson.continueButton).toBeDisabled();
    await lesson.setTemperature(5);
    await expect(lesson.continueButton, 'cooling above zero does not freeze').toBeDisabled();
    await lesson.setTemperature(-10);
    await expect(page.getByRole('status').or(page.locator('output'))).toContainText('−10 °C');
    await expect(lesson.sim('molecules')).toHaveAttribute(
      'aria-label',
      /six-sided rings.*Space taken: 109%/,
    );
    await expect(lesson.lumi).toHaveText(expected.frozen);
    await lesson.continue();

    // 5. Name it.
    await lesson.expectStep(5);
    await expect(lesson.heading('Ice is less dense than water.')).toBeVisible();
    await expect(page.locator('h1 em')).toHaveText('dense');
    if (expected.formula) {
      await expect(page.getByText('density ρ = mass m ÷ volume V')).toBeVisible();
      await expect(
        page.getByRole('row', { name: /Liquid water \(4 °C\).*1\.00 g\/cm³/ }),
      ).toBeVisible();
      await expect(page.getByRole('row', { name: /Ice \(0 °C\).*0\.92 g\/cm³/ })).toBeVisible();
    } else {
      await expect(page.getByText('density ρ = mass m ÷ volume V')).toHaveCount(0);
    }
    await lesson.continue();

    // 6. Challenge: sort six, then the lake.
    await lesson.expectStep(6);
    await expect(page.locator('[data-item]')).toHaveCount(6);
    await expect(page.getByText('1.42 g/cm³')).toHaveCount(expected.sortDetail ? 1 : 0);
    await lesson.sortButton('honey', 'Floats').click();
    await expect(lesson.lumi).toHaveText(/Not quite/);
    await lesson.sortAll();
    await expect(lesson.continueButton).toBeDisabled();
    await expect(lesson.sim('lake')).toHaveAttribute(
      'aria-label',
      /thin lid of ice on top\. 6 of 6 fish/,
    );
    await page.getByRole('button', { name: 'What if ice sank?' }).click();
    await expect(lesson.sim('lake')).toHaveAttribute(
      'aria-label',
      /piles up from the bottom\. 0 of 6 fish/,
      {
        timeout: 20_000,
      },
    );
    await page.getByRole('button', { name: 'Back to the real world' }).click();
    await expect(lesson.sim('lake')).toHaveAttribute('aria-label', /6 of 6 fish/);
    await lesson.continue();

    // 7. Keep: the card and where else.
    await lesson.expectStep(7);
    await expect(page.getByText('Ice floats because freezing water spreads out.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Where else does this show up?' }),
    ).toBeVisible();
    for (const place of ['The kettle', 'Icebergs', 'Burst pipes'])
      await expect(page.getByText(place, { exact: true })).toBeVisible();
    await expect(lesson.continueButton).toHaveText('Light up the town');
    await lesson.continue();

    await expect(page).toHaveURL(/\/town/);
    await expect(page.locator('[data-object="glass"]')).toHaveAttribute('data-state', 'done');
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('lumen.progress') ?? '{}'),
    );
    expect(stored.done.map((d: { lessonId: string }) => d.lessonId)).toEqual(['chem.ice-floats']);
    expect(stored.cards).toHaveLength(1);
  });
}

test('the hint ladder gives a nudge, a clue, a demo, and only then the answer', async ({
  page,
}) => {
  await seed(page);
  const lesson = new IceLesson(page);
  await lesson.open();
  await lesson.playTo('predict');

  await lesson.choice('smaller').click();
  await expect(lesson.lumi).toHaveText(/not quite\. Think about the ice cube/i);
  await expect(lesson.choice('smaller')).toBeDisabled();
  await expect(lesson.choice('bigger')).not.toHaveClass(/Glow/);

  await lesson.choice('same').click();
  await expect(lesson.lumi).toHaveText(/Here is a clue/);
  await expect(lesson.choice('bigger')).toHaveClass(/Glow/);
  await expect(lesson.continueButton).toBeDisabled();

  await page.getByRole('button', { name: 'Give me a hint' }).click();
  await expect(lesson.lumi).toHaveText(/Watch the ice cube/);
  await expect(page.getByRole('img', { name: /A worked example.*ice cube floats/ })).toBeVisible();
  await expect(lesson.continueButton, 'a demo is not the answer').toBeDisabled();

  await page.getByRole('button', { name: 'Give me a hint' }).click();
  await expect(lesson.lumi).toHaveText(/The ice takes up more space/);
  await expect(lesson.continueButton).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Give me a hint' })).toHaveCount(0);
  await expect(page.getByText(/wrong/i)).toHaveCount(0);
});

test('switching depth in the middle of a step keeps what the learner did', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  const lesson = new IceLesson(page);
  await lesson.open();
  await lesson.playTo('poke');
  await lesson.drop('Coin', 'Ice cube');
  await expect(lesson.sim('tank')).toHaveAttribute('aria-label', /coin has sunk/);

  if (isMobile) await page.getByRole('combobox', { name: 'Depth' }).selectOption('deep');
  else await page.getByRole('radio', { name: 'Deep' }).click();

  await expect(page.getByRole('button', { name: 'Coin', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Ice cube', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cork', exact: true })).toBeEnabled();
  await expect(lesson.sim('tank')).toHaveAttribute('aria-label', /coin has sunk/);
  await expect(lesson.lumi).toHaveText(/g\/cm³|density/);
  await lesson.expectStep(2);

  // The choice is remembered for the next visit.
  await page.reload();
  await expect(lesson.lumi).toHaveText(/Water is a rare exception/);
});

test('the whole lesson can be played with the keyboard alone', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard play is checked on the desktop layout');
  await seed(page, { depth: 'explain' });
  const lesson = new IceLesson(page);
  await lesson.open();

  const press = async (name: string | RegExp, key: 'Enter' | 'Space' = 'Enter') => {
    const target = page.getByRole('button', { name, exact: typeof name === 'string' }).first();
    await target.focus();
    await expect(target).toBeFocused();
    await page.keyboard.press(key);
  };
  const next = () => lesson.continueWithKeyboard();

  // The first Tab lands on a real control, and focus is always visible.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Back to town' })).toBeFocused();
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe('none');

  await next();
  await expect(lesson.heading('Sink or float?')).toBeFocused();
  await press('Coin', 'Space');
  await press('Cork');
  await press('Ice cube', 'Space');
  await next();

  await lesson.choice('bigger').focus();
  await page.keyboard.press('Space');
  await next();

  const slider = page.getByRole('slider', { name: 'Temperature' });
  await slider.focus();
  for (let i = 0; i < 22; i++) await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveValue('-2');
  await expect(lesson.sim('molecules')).toHaveAttribute('aria-label', /Space taken: 109%/);
  await next();
  await next();

  for (const [item, bin] of [
    ['log', 'Floats'],
    ['stone', 'Sinks'],
    ['iceberg', 'Floats'],
    ['bolt', 'Sinks'],
    ['oil', 'Floats'],
    ['honey', 'Sinks'],
  ] as const) {
    await lesson.sortButton(item, bin).focus();
    await page.keyboard.press('Enter');
  }
  await press('What if ice sank?');
  await next();
  await next();
  await expect(page).toHaveURL(/\/town/);
});

test('going back keeps earlier steps passable and Continue never skips a step', async ({
  page,
}) => {
  await seed(page);
  const lesson = new IceLesson(page);
  await lesson.open();
  await lesson.playTo('predict');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await lesson.expectStep(2);
  await lesson.doubleTapContinue();
  await lesson.expectStep(3);

  // A double tap on a step that leads to one that is ready at once must not skip it.
  await lesson.choice('bigger').click();
  await lesson.continue();
  await lesson.setTemperature(-10);
  await lesson.doubleTapContinue();
  await lesson.expectStep(5);
});

test('an unknown lesson shows a way back instead of a blank page', async ({ page }) => {
  await page.goto('/lesson/chem.does-not-exist');
  await expect(page.getByRole('heading', { name: "We can't find that lesson" })).toBeVisible();
  await page.getByRole('button', { name: 'Back to town' }).click();
  await expect(page).toHaveURL(/\/town$/);
});
