import { dayNumber, pickDailyLesson } from './daily';

describe('daily challenge', () => {
  const built = ['chem.ice-floats', 'phys.swing', 'math.scale'];

  it('uses the first playable lesson when nothing is finished', () => {
    expect(pickDailyLesson([], built, 5)).toBe('chem.ice-floats');
  });

  it('draws from finished lessons that can be played, changing day by day', () => {
    const done = ['phys.swing', 'math.scale', 'chem.retired'];
    const picks = new Set([0, 1, 2, 3].map((day) => pickDailyLesson(done, built, day)));
    expect(picks).toEqual(new Set(['phys.swing', 'math.scale']));
  });

  it('is stable within a day', () => {
    expect(pickDailyLesson(['phys.swing', 'math.scale'], built, 7)).toBe(
      pickDailyLesson(['phys.swing', 'math.scale'], built, 7),
    );
  });

  it('returns nothing when no lesson is playable', () => {
    expect(pickDailyLesson(['x'], [], 1)).toBeNull();
  });

  it('numbers local calendar days', () => {
    const a = new Date(2026, 9, 12, 0, 5).getTime();
    const b = new Date(2026, 9, 12, 23, 55).getTime();
    const c = new Date(2026, 9, 13, 0, 5).getTime();
    expect(dayNumber(a)).toBe(dayNumber(b));
    expect(dayNumber(c)).toBe(dayNumber(a) + 1);
  });
});
