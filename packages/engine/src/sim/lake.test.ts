import LakeSim from './lake';
import { expectTextFits, rendersEverywhere, run, testEnv } from './testkit';

function make() {
  const env = testEnv();
  const sim = new LakeSim();
  sim.init({}, env);
  return { sim, env };
}

describe('lake', () => {
  it('in the real world ice stays a thin lid and every fish keeps swimming', () => {
    const { sim, env } = make();
    run(sim, 20);
    const state = sim.getState();
    expect(state.mode).toBe('real');
    expect(state.fishSwimming).toBe(6);
    expect(state.iceShare as number).toBeLessThanOrEqual(0.22);
    expect(state.iceShare as number).toBeGreaterThan(0.15);
    expect(env.bus.has('froze', 'lid')).toBe(true);
    expect(env.bus.seen('trapped')).toBe(false);
  });

  it('in the pretend world the lake freezes from the bottom up and traps the fish', () => {
    const { sim, env } = make();
    sim.setParam('mode', 'sank');
    run(sim, 20);
    const state = sim.getState();
    expect(state.mode).toBe('sank');
    expect(state.fishSwimming).toBe(0);
    expect(state.iceShare).toBe(1);
    expect(env.bus.count('trapped')).toBe(6);
    expect(env.bus.has('froze', 'solid')).toBe(true);
  });

  it('traps the deepest fish first', () => {
    const { sim } = make();
    sim.setParam('mode', 'sank');
    run(sim, 3.5);
    const fish = sim.fishSnapshot();
    const trapped = fish.filter((f) => f.trapped);
    const free = fish.filter((f) => !f.trapped);
    expect(trapped.length).toBeGreaterThan(0);
    expect(free.length).toBeGreaterThan(0);
    expect(Math.min(...trapped.map((f) => f.depth))).toBeGreaterThan(Math.max(...free.map((f) => f.depth)));
  });

  it('going back to the real world frees every fish', () => {
    const { sim } = make();
    sim.setParam('mode', 'sank');
    run(sim, 20);
    sim.setParam('mode', 'real');
    run(sim, 1);
    expect(sim.getState().fishSwimming).toBe(6);
  });

  it('ignores an unknown mode', () => {
    const { sim } = make();
    sim.setParam('mode', 'lava');
    expect(sim.getState().mode).toBe('real');
  });

  it('keeps fish inside the lake', () => {
    const { sim } = make();
    run(sim, 60);
    for (const fish of sim.fishSnapshot()) {
      expect(fish.x).toBeGreaterThanOrEqual(0.1);
      expect(fish.x).toBeLessThanOrEqual(0.9);
    }
  });

  it('renders at any size and describes itself', () => {
    const { sim } = make();
    run(sim, 1);
    expect(() => rendersEverywhere(sim)).not.toThrow();
    expect(sim.describe()).toContain('sim.lake.describeReal');
  });

  it.each([320, 358, 560, 1200])('keeps all its text inside a %ipx wide canvas', (width) => {
    for (const depth of ['play', 'explain', 'deep'] as const) {
      const sim = new LakeSim();
      sim.init({}, testEnv({ depth, english: true }));
      sim.setParam('temperature', -5);
      run(sim, 6);
      expect(() => expectTextFits(sim, width, 260)).not.toThrow();
    }
  });
});
