import type { Depth } from '../depth';
import { EventBus } from '../events';
import { createRandom } from '../random';
import en from '../../../../apps/web/src/i18n/en.json';
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

type Tree = { [key: string]: string | Tree };

/** The real English strings, so layout tests measure text of the true length. */
export function english(key: string, vars?: Record<string, string | number>): string {
  let node: string | Tree | undefined = en as Tree;
  for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined;
  if (typeof node !== 'string') return key;
  return node.replace(/\{(\w+)\}/g, (match, name: string) => (vars && name in vars ? String(vars[name]) : match));
}

export function testEnv(options: { depth?: Depth; seed?: number; reducedMotion?: boolean; english?: boolean } = {}): SimEnv & {
  texts: string[];
} {
  const texts: string[] = [];
  return {
    bus: new EventBus(),
    depth: () => options.depth ?? 'play',
    random: createRandom(options.seed ?? 7),
    reducedMotion: options.reducedMotion ?? true,
    t: options.english ? english : (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
    texts,
  };
}

/** A stand-in for a 2D canvas context that accepts every call and records drawn text. */
export type DrawnText = { text: string; x: number; y: number; align: string; width: number };

export function fakeContext(drawn: string[] = [], placed: DrawnText[] = []): CanvasRenderingContext2D {
  const target: Record<string, unknown> = { textAlign: 'start' };
  return new Proxy(target, {
    get(obj, prop: string) {
      if (prop in obj) return obj[prop];
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 7 });
      if (prop === 'fillText' || prop === 'strokeText')
        return (text: string, x: number, y: number) => {
          drawn.push(text);
          placed.push({ text, x, y, align: String(obj.textAlign), width: text.length * 7 });
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

/** Every piece of text drawn at this size, with the left and right edge it would occupy. */
export function textExtents(sim: Simulation, width: number, height: number): { text: string; left: number; right: number }[] {
  const placed: DrawnText[] = [];
  sim.render(fakeContext([], placed), view(width, height, 1));
  return placed.map((p) => {
    const left = p.align === 'center' ? p.x - p.width / 2 : p.align === 'right' ? p.x - p.width : p.x;
    return { text: p.text, left, right: left + p.width };
  });
}

/** Fails if any text would be cut off by the edge of the canvas. */
export function expectTextFits(sim: Simulation, width: number, height: number): void {
  for (const extent of textExtents(sim, width, height)) {
    if (extent.left < 0 || extent.right > width) {
      throw new Error(`"${extent.text}" spans ${extent.left}..${extent.right} on a ${width}px canvas`);
    }
  }
}
