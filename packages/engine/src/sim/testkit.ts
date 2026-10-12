import type { Depth } from '../depth';
import { EventBus } from '../events';
import { createRandom } from '../random';
import type { SimColors, SimEnv, Simulation, SimView } from './types';

/** Helpers for simulation unit tests. Not used by the app. */

export const TEST_COLORS: SimColors = {
  ink: '#16161D',
  paper: '#FFFFFF',
  mist: '#F6F6F8',
  line: '#E6E6EC',
  graphite: '#55555F',
  water: '#8FCFF2',
  sky: '#EEF5FC',
  ground: '#E3F1D9',
  accent: '#14A37F',
  lumi: '#FFC21A',
};

export function testEnv(options: { depth?: Depth; seed?: number; reducedMotion?: boolean } = {}): SimEnv & {
  texts: string[];
} {
  const texts: string[] = [];
  return {
    bus: new EventBus(),
    depth: () => options.depth ?? 'play',
    random: createRandom(options.seed ?? 7),
    reducedMotion: options.reducedMotion ?? true,
    t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
    texts,
  };
}

/** A stand-in for a 2D canvas context that accepts every call and records drawn text. */
export function fakeContext(drawn: string[] = []): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get(obj, prop: string) {
      if (prop in obj) return obj[prop];
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 7 });
      if (prop === 'fillText' || prop === 'strokeText')
        return (text: string) => {
          drawn.push(text);
        };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
        return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set(obj, prop: string, value) {
      obj[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

export function view(width = 560, height = 300, time = 0): SimView {
  return { width, height, colors: TEST_COLORS, time };
}

export function run(sim: Simulation, seconds: number, dt = 1 / 60): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) sim.step(dt);
}

/** Renders at a few awkward sizes to catch divisions by zero and NaN geometry. */
export function rendersEverywhere(sim: Simulation): string[] {
  const drawn: string[] = [];
  for (const [w, h] of [
    [560, 300],
    [320, 240],
    [1200, 440],
    [0, 0],
    [1, 1],
  ] as const) {
    sim.render(fakeContext(drawn), view(w, h, 1.5));
  }
  return drawn;
}
