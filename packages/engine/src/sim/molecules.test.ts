import MoleculesSim from './molecules';
import { fakeContext, rendersEverywhere, run, testEnv, view } from './testkit';

function make(config: Record<string, unknown> = {}, depth: 'play' | 'explain' | 'deep' = 'play') {
  const env = testEnv({ depth });
  const sim = new MoleculesSim();
  sim.init(config, env);
  return { sim, env };
}

describe('molecules', () => {
  it('has 48 water molecules', () => {
    expect(make().sim.getState().molecules).toBe(48);
  });

  it('stays liquid at 20 °C', () => {
    const { sim, env } = make();
    run(sim, 5);
    expect(sim.getState()).toMatchObject({ temperature: 20, frozen: false, space: 100 });
    expect(env.bus.log()).toHaveLength(0);
  });

  it('freezes below 0 °C, takes 9% more space and says so once', () => {
    const { sim, env } = make();
    sim.setParam('temperature', -5);
    run(sim, 5);
    expect(sim.getState()).toMatchObject({ temperature: -5, frozen: true, space: 109 });
    expect(env.bus.log().filter((e) => e.type === 'froze')).toHaveLength(1);
  });

  it('does not freeze at exactly 0 °C or just above', () => {
    const { sim, env } = make();
    sim.setParam('temperature', 0);
    run(sim, 5);
    expect(sim.getState().frozen).toBe(false);
    sim.setParam('temperature', 1);
    run(sim, 5);
    expect(env.bus.seen('froze')).toBe(false);
  });

  it('melts again when warmed, and can refreeze', () => {
    const { sim, env } = make();
    sim.setParam('temperature', -10);
    run(sim, 5);
    sim.setParam('temperature', 10);
    run(sim, 5);
    expect(sim.getState()).toMatchObject({ frozen: false, space: 100 });
    expect(env.bus.log().map((e) => e.type)).toEqual(['froze', 'melted']);
    sim.setParam('temperature', -1);
    run(sim, 5);
    expect(env.bus.log().map((e) => e.type)).toEqual(['froze', 'melted', 'froze']);
  });

  it('gives every lattice molecule at most three bonded neighbours, in six-sided rings', () => {
    const { sim } = make();
    const bonds = sim.bondCounts();
    expect(Math.max(...bonds)).toBe(3);
    expect(bonds.filter((n) => n === 3).length).toBeGreaterThan(10);
  });

  it('keeps the H–O–H angle at 104.5 degrees', () => {
    expect(make().sim.bondAngleDegrees()).toBe(104.5);
  });

  it('shows the space readout and a legend that suits the depth', () => {
    const { sim } = make({}, 'deep');
    sim.setParam('temperature', -5);
    run(sim, 5);
    const drawn: string[] = [];
    sim.render(fakeContext(drawn), view());
    expect(drawn).toContain('sim.molecules.space {"percent":109}');
    expect(drawn).toContain('sim.molecules.legend.deep');
  });

  it('ignores a temperature that is not a number', () => {
    const { sim } = make();
    sim.setParam('temperature', 'cold');
    expect(sim.getState().temperature).toBe(20);
  });

  it('renders at any size and describes itself', () => {
    const { sim } = make();
    run(sim, 1);
    expect(() => rendersEverywhere(sim)).not.toThrow();
    expect(sim.describe()).toContain('sim.molecules.describeLiquid');
  });
});
