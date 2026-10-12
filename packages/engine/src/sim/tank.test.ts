import TankSim from './tank';
import { expectTextFits, fakeContext, rendersEverywhere, run, testEnv, view } from './testkit';

function make(config: Record<string, unknown> = {}, depth: 'play' | 'explain' | 'deep' = 'play') {
  const env = testEnv({ depth });
  const sim = new TankSim();
  sim.init(config, env);
  return { sim, env };
}

describe('tank', () => {
  it.each([
    ['ice', 0.92],
    ['cork', 0.24],
    ['apple', 0.8],
  ])('%s settles with its density as the fraction under water', (id, fraction) => {
    const { sim } = make();
    sim.setParam('drop', id);
    run(sim, 8);
    const item = sim.snapshot()[0]!;
    expect(item.floats).toBe(true);
    expect(item.submerged).toBeGreaterThan(fraction - 0.02);
    expect(item.submerged).toBeLessThan(fraction + 0.02);
  });

  it.each(['coin', 'stone'])('%s sinks to the floor', (id) => {
    const { sim } = make();
    sim.setParam('drop', id);
    run(sim, 8);
    const item = sim.snapshot()[0]!;
    expect(item.floats).toBe(false);
    expect(item.onFloor).toBe(true);
    expect(item.submerged).toBe(1);
  });

  it('emits dropped, then settled, once each per item', () => {
    const { sim, env } = make();
    sim.setParam('drop', 'ice');
    run(sim, 8);
    expect(env.bus.log().map((e) => `${e.type}:${e.value}`)).toEqual(['dropped:ice', 'settled:ice']);
  });

  it('starts preset items already at rest without events', () => {
    const { sim, env } = make({ items: ['ice', 'stone'] });
    run(sim, 0.1);
    const [ice, stone] = sim.snapshot();
    expect(ice!.submerged).toBeCloseTo(0.92, 1);
    expect(stone!.onFloor).toBe(true);
    expect(env.bus.log()).toHaveLength(0);
  });

  it('ignores unknown items and a second drop of the same item', () => {
    const { sim, env } = make();
    sim.setParam('drop', 'unicorn');
    sim.setParam('drop', 'ice');
    sim.setParam('drop', 'ice');
    expect(sim.snapshot()).toHaveLength(1);
    expect(env.bus.count('dropped')).toBe(1);
  });

  it('reports what is in the tank', () => {
    const { sim } = make();
    sim.setParam('drop', 'coin');
    sim.setParam('drop', 'ice');
    expect(sim.getState()).toMatchObject({ count: 2, floating: 1, sunk: 1 });
  });

  it.each([
    ['play', 'sim.tank.floats', 'sim.tank.sinks'],
    ['explain', 'sim.tank.floatsUnder {"percent":92}', 'sim.tank.sinks'],
    ['deep', 'sim.tank.densityUnder {"rho":"0.92","percent":92}', 'sim.tank.density {"rho":"8.9"}'],
  ] as const)('labels items at %s depth', (depth, iceLabel, coinLabel) => {
    const { sim } = make({ labels: true }, depth);
    sim.setParam('drop', 'ice');
    sim.setParam('drop', 'coin');
    run(sim, 8);
    const drawn: string[] = [];
    sim.render(fakeContext(drawn), view());
    expect(drawn).toContain(iceLabel);
    expect(drawn).toContain(coinLabel);
  });

  it('draws no labels unless asked', () => {
    const { sim } = make({ items: ['ice'] });
    run(sim, 3);
    const drawn: string[] = [];
    sim.render(fakeContext(drawn), view());
    expect(drawn).toHaveLength(0);
  });

  it('renders at any size, including zero, and describes itself', () => {
    const { sim } = make({ items: ['ice', 'stone'], labels: true });
    run(sim, 2);
    expect(() => rendersEverywhere(sim)).not.toThrow();
    expect(sim.describe()).toContain('sim.tank.describe');
  });

  it('survives a very large time step', () => {
    const { sim } = make();
    sim.setParam('drop', 'ice');
    sim.step(5);
    run(sim, 8);
    expect(Number.isFinite(sim.snapshot()[0]!.submerged)).toBe(true);
    expect(sim.snapshot()[0]!.submerged).toBeCloseTo(0.92, 1);
  });

  it.each([320, 358, 560, 1200])('keeps all its text inside a %ipx wide canvas', (width) => {
    for (const depth of ['play', 'explain', 'deep'] as const) {
      const sim = new TankSim();
      sim.init({ items: ['ice', 'stone', 'coin', 'cork'], labels: true }, testEnv({ depth, english: true }));
      sim.setParam('temperature', -5);
      run(sim, 6);
      expect(() => expectTextFits(sim, width, 260)).not.toThrow();
    }
  });
});
