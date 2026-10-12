import { expect, type Locator, type Page } from '@playwright/test';

/** Drives the "Why does ice float?" lesson the way a learner would. */
export class IceLesson {
  private lastContinue = 0;

  constructor(readonly page: Page) {}

  /**
   * The lesson ignores a second Continue within 300 ms of the last one, so a double tap cannot
   * skip a step. No person is that fast, but a script is, so the driver waits like a person would.
   */
  async settle(): Promise<void> {
    const wait = 350 - (Date.now() - this.lastContinue);
    if (wait > 0) await this.page.waitForTimeout(wait);
  }

  async open(): Promise<void> {
    await this.page.goto('/lesson/chem.ice-floats');
    await expect(this.heading('Why does ice float?')).toBeVisible();
  }

  heading(name: string | RegExp): Locator {
    return this.page.getByRole('heading', { level: 1, name });
  }

  get lumi(): Locator {
    return this.page.getByTestId('lumi-text');
  }

  get continueButton(): Locator {
    return this.page.locator('footer button').last();
  }

  sim(kind: string): Locator {
    return this.page.locator(`[data-sim="${kind}"][data-status="ready"]`).first();
  }

  async continue(): Promise<void> {
    await expect(this.continueButton).toBeEnabled();
    await this.settle();
    await this.continueButton.click();
    this.lastContinue = Date.now();
  }

  /** Two activations in quick succession, as an impatient learner might do. */
  async doubleTapContinue(): Promise<void> {
    await expect(this.continueButton).toBeEnabled();
    await this.settle();
    await this.continueButton.dblclick();
    this.lastContinue = Date.now();
  }

  /** Continue using the keyboard only. */
  async continueWithKeyboard(): Promise<void> {
    await expect(this.continueButton).toBeEnabled();
    await this.settle();
    await this.continueButton.focus();
    await this.page.keyboard.press('Enter');
    this.lastContinue = Date.now();
  }

  async expectStep(current: number): Promise<void> {
    await expect(this.page.getByRole('img', { name: `Step ${current} of 7` })).toBeVisible();
  }

  async drop(...items: string[]): Promise<void> {
    for (const item of items) await this.page.getByRole('button', { name: item, exact: true }).click();
  }

  choice(id: 'smaller' | 'same' | 'bigger'): Locator {
    return this.page.locator(`[data-choice="${id}"]`);
  }

  async setTemperature(value: number): Promise<void> {
    await this.page.getByRole('slider', { name: 'Temperature' }).fill(String(value));
  }

  sortButton(item: string, bin: 'Floats' | 'Sinks'): Locator {
    return this.page.locator(`[data-item="${item}"]`).getByRole('button', { name: new RegExp(`: ${bin}$`) });
  }

  async sortAll(): Promise<void> {
    const answers: [string, 'Floats' | 'Sinks'][] = [
      ['log', 'Floats'],
      ['stone', 'Sinks'],
      ['iceberg', 'Floats'],
      ['bolt', 'Sinks'],
      ['oil', 'Floats'],
      ['honey', 'Sinks'],
    ];
    for (const [item, bin] of answers) await this.sortButton(item, bin).click();
  }

  /** Plays from the hook up to (not past) the named step, taking the shortest correct path. */
  async playTo(step: 'poke' | 'predict' | 'zoom' | 'name_it' | 'challenge' | 'keep'): Promise<void> {
    const order = ['poke', 'predict', 'zoom', 'name_it', 'challenge', 'keep'];
    const target = order.indexOf(step);
    await this.continue();
    if (target === 0) return;
    await this.drop('Coin', 'Cork', 'Ice cube');
    await this.continue();
    if (target === 1) return;
    await this.choice('bigger').click();
    await this.continue();
    if (target === 2) return;
    await this.setTemperature(-10);
    await this.continue();
    if (target === 3) return;
    await this.continue();
    if (target === 4) return;
    await this.sortAll();
    await this.page.getByRole('button', { name: 'What if ice sank?' }).click();
    await this.continue();
  }
}
