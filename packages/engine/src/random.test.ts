import { createRandom } from './random';

describe('createRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRandom(1);
    const b = createRandom(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives different sequences for different seeds', () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });

  it('stays within [0, 1) and is roughly uniform', () => {
    const r = createRandom(42);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10000).toBeCloseTo(0.5, 1);
  });
});
