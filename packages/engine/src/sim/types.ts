import type { Depth } from '../depth';
import type { EventBus, SimEventInput } from '../events';

export type SimValue = number | string | boolean;
export type SimState = Record<string, SimValue>;

/** Interface colours, read from CSS custom properties so simulations follow the theme. */
export type SimColors = Record<
  'ink' | 'paper' | 'mist' | 'line' | 'graphite' | 'water' | 'sky' | 'ground' | 'accent' | 'lumi',
  string
>;

export type SimView = { width: number; height: number; colors: SimColors; time: number };

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export type SimEnv = {
  bus: EventBus;
  depth: () => Depth;
  random: () => number;
  /** Decorative motion (bobbing, jitter, waves) is switched off when true. */
  reducedMotion: boolean;
  /** Looks up a string in the interface language. */
  t: Translate;
};

export interface Simulation {
  init(config: Record<string, unknown>, env: SimEnv): void;
  step(dt: number): void;
  render(ctx: CanvasRenderingContext2D, view: SimView): void;
  setParam(key: string, value: SimValue): void;
  getState(): SimState;
  emit(event: SimEventInput): void;
  /** One-sentence text alternative for people who cannot see the canvas. */
  describe(): string;
  /** Pointer input in canvas pixels, for simulations that can be touched directly. */
  pointer?(kind: 'down' | 'move' | 'up', x: number, y: number, view: SimView): void;
  destroy?(): void;
}

export type SimulationClass = new () => Simulation;

/** Shared plumbing. A simulation extends this and fills in its physics and drawing. */
export abstract class BaseSim implements Simulation {
  protected env!: SimEnv;
  protected time = 0;

  init(config: Record<string, unknown>, env: SimEnv): void {
    this.env = env;
    this.time = 0;
    this.setup(config);
  }

  protected abstract setup(config: Record<string, unknown>): void;
  abstract step(dt: number): void;
  abstract render(ctx: CanvasRenderingContext2D, view: SimView): void;
  abstract describe(): string;

  setParam(_key: string, _value: SimValue): void {}

  getState(): SimState {
    return {};
  }

  emit(event: SimEventInput): void {
    this.env.bus.emit(event);
  }
}

export const TAU = Math.PI * 2;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** A dark rounded label with light text, used for readouts drawn on the canvas. */
export function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colors: SimColors,
  options: { size?: number; mono?: boolean; bounds?: [number, number] } = {},
): void {
  const size = options.size ?? 13;
  ctx.font = options.mono
    ? `500 ${size}px "IBM Plex Mono", ui-monospace, monospace`
    : `700 ${size}px "Atkinson Hyperlegible", Verdana, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(text).width + 16;
  const height = size + 10;
  let cx = x;
  if (options.bounds) cx = clamp(x, options.bounds[0] + width / 2, options.bounds[1] - width / 2);
  ctx.fillStyle = colors.ink;
  roundRect(ctx, cx - width / 2, y - height / 2, width, height, height / 2);
  ctx.fill();
  ctx.fillStyle = colors.paper;
  ctx.fillText(text, cx, y + 0.5);
  ctx.textBaseline = 'alphabetic';
}

export const FONT_BODY = '"Atkinson Hyperlegible", Verdana, sans-serif';
export const FONT_MONO = '"IBM Plex Mono", ui-monospace, monospace';

/** Splits text into lines no wider than maxWidth, using the context's current font. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws left-aligned text that wraps upward from a bottom edge, so captions never run off the canvas. */
export function caption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  bottom: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const lines = wrapText(ctx, text, Math.max(40, maxWidth));
  lines.forEach((line, index) => {
    ctx.fillText(line, x, bottom - (lines.length - 1 - index) * lineHeight);
  });
}
