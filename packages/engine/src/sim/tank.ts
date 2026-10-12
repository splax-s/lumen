import { TANK_ITEMS, WATER_DENSITY, type TankItem } from './data/items';
import { BaseSim, TAU, pill, roundRect, type SimColors, type SimState, type SimValue, type SimView } from './types';

/**
 * A water tank. Things dropped in either sink to the floor or float at the depth where the
 * fraction under water equals their density divided by the density of water (Archimedes).
 *
 * Physics runs in a fixed 300-unit-tall space so it does not depend on the canvas size.
 */

const SPACE_H = 300;
const TOP = 42;
const SURFACE = 108;
const FLOOR = 270;
const GRAVITY = 900;
const MAX_STEP = 1 / 60;

type Body = {
  id: string;
  def: TankItem;
  slot: number;
  /** Y of the bottom edge, in tank units. */
  yb: number;
  v: number;
  age: number;
  phase: number;
  settled: boolean;
};

export type TankSnapshot = { id: string; floats: boolean; submerged: number; onFloor: boolean; settled: boolean };

export default class TankSim extends BaseSim {
  private bodies: Body[] = [];
  private labels = false;

  protected setup(config: Record<string, unknown>): void {
    this.bodies = [];
    this.labels = config.labels === true;
    const preset = Array.isArray(config.items) ? config.items : [];
    for (const id of preset) if (typeof id === 'string') this.add(id, true);
  }

  override setParam(key: string, value: SimValue): void {
    if (key === 'drop' && typeof value === 'string') {
      if (this.add(value, false)) this.emit({ type: 'dropped', value });
    } else if (key === 'labels') {
      this.labels = value === true;
    }
  }

  private add(id: string, atRest: boolean): boolean {
    const def = TANK_ITEMS[id];
    if (!def || this.bodies.some((b) => b.id === id)) return false;
    this.bodies.push({
      id,
      def,
      slot: this.bodies.length,
      yb: atRest ? this.restY(def) : TOP - 10,
      v: 0,
      age: atRest ? 10 : 0,
      phase: this.env.random() * TAU,
      settled: atRest,
    });
    return true;
  }

  private restY(def: TankItem): number {
    return def.rho < WATER_DENSITY ? SURFACE + def.h * (def.rho / WATER_DENSITY) : FLOOR;
  }

  step(dt: number): void {
    let remaining = Math.min(Math.max(dt, 0), 0.05);
    while (remaining > 1e-9) {
      const h = Math.min(MAX_STEP, remaining);
      this.advance(h);
      remaining -= h;
    }
  }

  private advance(dt: number): void {
    this.time += dt;
    for (const body of this.bodies) {
      const floats = body.def.rho < WATER_DENSITY;
      const rest = this.restY(body.def);
      if (body.yb < SURFACE) {
        body.v += GRAVITY * dt;
      } else if (floats) {
        // Buoyancy pulls a floater toward its resting depth; water drag settles it.
        body.v += (40 * (rest - body.yb) - 7 * body.v) * dt;
      } else {
        body.v += (6 * (rest - body.yb) - 3.5 * body.v) * dt;
        body.v = Math.min(body.v, 160);
      }
      body.yb += body.v * dt;
      if (body.yb >= FLOOR) {
        body.yb = FLOOR;
        body.v = 0;
      }
      body.age += dt;
      if (!body.settled && body.age > 0.3) {
        const atRest = floats ? Math.abs(body.v) < 3 && Math.abs(body.yb - rest) < 0.8 : body.yb === FLOOR;
        if (atRest) {
          body.settled = true;
          this.emit({ type: 'settled', value: body.id });
        }
      }
    }
  }

  /** Where each item is, for tests and for the text alternative. */
  snapshot(): TankSnapshot[] {
    return this.bodies.map((body) => ({
      id: body.id,
      floats: body.def.rho < WATER_DENSITY,
      submerged: Math.max(0, Math.min(1, (body.yb - SURFACE) / body.def.h)),
      onFloor: body.yb === FLOOR,
      settled: body.settled,
    }));
  }

  override getState(): SimState {
    const floating = this.bodies.filter((b) => b.def.rho < WATER_DENSITY).length;
    return { count: this.bodies.length, floating, sunk: this.bodies.length - floating };
  }

  describe(): string {
    const t = this.env.t;
    if (this.bodies.length === 0) return t('sim.tank.describeEmpty');
    const parts = this.bodies.map((body) =>
      body.def.rho < WATER_DENSITY
        ? t('sim.tank.describeFloats', { item: t(`item.${body.id}`), percent: Math.round(body.def.rho * 100) })
        : t('sim.tank.describeSinks', { item: t(`item.${body.id}`) }),
    );
    return t('sim.tank.describe', { list: parts.join(' ') });
  }

  private label(body: Body): string {
    const t = this.env.t;
    const floats = body.def.rho < WATER_DENSITY;
    const percent = Math.round((body.def.rho / WATER_DENSITY) * 100);
    const depth = this.env.depth();
    if (depth === 'play') return floats ? t('sim.tank.floats') : t('sim.tank.sinks');
    if (depth === 'explain') return floats ? t('sim.tank.floatsUnder', { percent }) : t('sim.tank.sinks');
    const rho = String(body.def.rho);
    return floats ? t('sim.tank.densityUnder', { rho, percent }) : t('sim.tank.density', { rho });
  }

  render(ctx: CanvasRenderingContext2D, view: SimView): void {
    const { width: W, height: H, colors } = view;
    if (W <= 0 || H <= 0) return;
    const s = H / SPACE_H;
    const left = W * 0.08;
    const span = W * 0.84;
    const top = TOP * s;
    const surface = SURFACE * s;
    const floor = FLOOR * s;
    const slots = Math.max(4, this.bodies.length);
    // Items shrink a little on narrow screens so four fit side by side.
    const size = Math.min(s, span / slots / 46);

    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = colors.water;
    ctx.fillRect(left, surface, span, floor - surface);
    ctx.globalAlpha = 1;

    const placed: { body: Body; x: number; bottom: number; h: number }[] = [];
    for (const body of this.bodies) {
      const x = left + (span * (body.slot + 0.5)) / slots;
      const floats = body.def.rho < WATER_DENSITY;
      const bob = floats && body.settled && !this.env.reducedMotion ? Math.sin(this.time * 2 + body.phase) * 1.2 : 0;
      // Depth below the surface is drawn at the item's own scale so the submerged fraction stays true.
      const bottom =
        body.yb >= FLOOR
          ? floor
          : body.yb > SURFACE
            ? Math.min(floor, surface + (body.yb - SURFACE) * (floats ? size : s) + bob)
            : body.yb * s;
      const w = body.def.w * size;
      const h = body.def.h * size;
      drawItem(ctx, body.id, body.def, x, bottom, w, h, colors);
      placed.push({ body, x, bottom, h });
    }

    // A second wash of water tints whatever is below the surface.
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = colors.water;
    ctx.fillRect(left, surface, span, floor - surface);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, surface);
    for (let x = left; x <= left + span; x += 8) {
      const ripple = this.env.reducedMotion ? 0 : Math.sin(x * 0.05 + this.time * 2) * 1.2;
      ctx.lineTo(x, surface + ripple);
    }
    ctx.lineTo(left + span, surface);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, floor);
    ctx.lineTo(left + span, floor);
    ctx.lineTo(left + span, top);
    ctx.stroke();

    if (this.labels) {
      const fontSize = Math.round(Math.max(11, Math.min(14, 13 * s)));
      for (const { body, x, bottom, h } of placed) {
        if (body.age < 1.3) continue;
        const y = Math.max(fontSize, bottom - h - fontSize - 4);
        pill(ctx, this.label(body), x, y, colors, {
          size: fontSize,
          mono: this.env.depth() === 'deep',
          bounds: [4, W - 4],
        });
      }
    }
  }
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  id: string,
  def: TankItem,
  x: number,
  yb: number,
  w: number,
  h: number,
  colors: SimColors,
): void {
  ctx.lineWidth = 1.75;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colors.ink;
  ctx.fillStyle = def.color;
  if (id === 'coin') {
    roundRect(ctx, x - w / 2, yb - h, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
  } else if (id === 'cork') {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, yb - h);
    ctx.lineTo(x + w / 2, yb - h);
    ctx.lineTo(x + w * 0.4, yb);
    ctx.lineTo(x - w * 0.4, yb);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (id === 'ice') {
    roundRect(ctx, x - w / 2, yb - h, w, h, w * 0.18);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - w * 0.28, yb - h * 0.72);
    ctx.lineTo(x - w * 0.05, yb - h * 0.85);
    ctx.stroke();
  } else if (id === 'apple') {
    ctx.beginPath();
    ctx.ellipse(x, yb - h / 2, w / 2, h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, yb - h);
    ctx.lineTo(x + 2, yb - h - 8);
    ctx.stroke();
    ctx.fillStyle = '#5AA62D';
    ctx.beginPath();
    ctx.ellipse(x + 8, yb - h - 5, 6, 3, -0.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, yb);
    ctx.quadraticCurveTo(x - w / 2, yb - h, x - w * 0.1, yb - h);
    ctx.quadraticCurveTo(x + w / 2, yb - h * 1.05, x + w / 2, yb);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
