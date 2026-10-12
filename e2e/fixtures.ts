import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';

/**
 * Shared test setup. Every test fails if the page logs a console error or throws,
 * and helpers here apply the same layout and accessibility checks to every screen.
 */

export type Depth = 'play' | 'explain' | 'deep';

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      page.on('requestfailed', (request) => {
        const failure = request.failure()?.errorText ?? '';
        if (!failure.includes('ERR_ABORTED'))
          problems.push(`request failed: ${request.url()} ${failure}`);
      });
      await use(problems);
      expect(problems, 'the page should not log errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export type SeedProgress = { depth?: Depth; done?: string[]; narrate?: boolean };

/** Starts the app with known local progress. Narration is off so tests are quiet. */
export async function seed(page: Page, options: SeedProgress = {}): Promise<void> {
  await page.addInitScript((opts) => {
    if (sessionStorage.getItem('lumen.seeded')) return;
    sessionStorage.setItem('lumen.seeded', '1');
    const now = Date.now();
    const done = (opts.done ?? []).map((lessonId, index) => ({
      lessonId,
      at: now - (10 - index) * 1000,
    }));
    localStorage.setItem(
      'lumen.progress',
      JSON.stringify({
        version: 1,
        depth: opts.depth ?? 'play',
        narrate: opts.narrate ?? false,
        done,
        cards: done,
        streak: {
          current: done.length ? 1 : 0,
          longest: done.length ? 1 : 0,
          lastDay: null,
          restDaysLeft: 2,
        },
        pendingAttempts: [],
      }),
    );
  }, options);
}

/** The page itself must never scroll sideways. */
export async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    view: window.innerWidth,
  }));
  expect(overflow.doc, 'page is wider than the screen').toBeLessThanOrEqual(overflow.view);
}

/** Nothing visible may hang off the right or left edge, and no text may be cut off by its box. */
export async function expectNothingClipped(page: Page): Promise<void> {
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const inScroller = (el: Element) => el.closest('[data-scroll-x]') !== null;
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 40)} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el.closest('.lm-visually-hidden') || style.clipPath.includes('inset(50%)')) continue;
      if (!inScroller(el) && (rect.right > window.innerWidth + 1 || rect.left < -1)) {
        out.push(
          `off screen: ${describe(el)} (${Math.round(rect.left)}..${Math.round(rect.right)})`,
        );
      }
      const hasOwnText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
      );
      if (hasOwnText && el.tagName !== 'SELECT' && el.tagName !== 'OPTION') {
        const clipsX = style.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1;
        const clipsY = style.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 1;
        if (clipsX || clipsY) out.push(`text cut off: ${describe(el)}`);
      }
    }
    return out;
  });
  expect(problems, 'nothing should be clipped or off screen').toEqual([]);
}

/** Controls on learner screens are at least 48 px in both directions. */
export async function expectBigTargets(page: Page, min = 48): Promise<void> {
  const small = await page.evaluate((limit) => {
    const out: string[] = [];
    const selector =
      'button, [role="radio"], select, input:not([type="hidden"]), summary, a[data-button]';
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      // A checkbox or radio button is tapped through its label, so the label is the target.
      const isTick =
        el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
      const rect = ((isTick && el.closest('label')) || el).getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.height < limit - 0.5 || rect.width < limit - 0.5) {
        const name =
          el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? el.tagName;
        out.push(
          `${el.tagName.toLowerCase()} "${name}" is ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        );
      }
    }
    return out;
  }, min);
  expect(small, `controls should be at least ${min}px`).toEqual([]);
}

/** No serious or critical accessibility violations. */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const bad = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join('; ')})`,
    );
  expect(bad, 'no serious accessibility violations').toEqual([]);
}

/** All the layout and accessibility checks that apply to every screen. */
export async function expectScreenIsSound(page: Page): Promise<void> {
  await expectNoSidewaysScroll(page);
  await expectNothingClipped(page);
  await expectBigTargets(page);
  await expectAccessible(page);
}
