import {
  BaseSim,
  FONT_BODY,
  FONT_MONO,
  TAU,
  type SimState,
  type SimValue,
  type SimView,
} from './types';

/**
 * A lake in winter, cut through the middle. In the real world ice floats, so it forms a lid
 * and the water underneath stays liquid. In the pretend world ice sinks, piles up from the
 * bottom, and the fish run out of water.
 *
 * Positions are fractions: x across the lake, depth from the surface (0) to the deepest point (1).
 */

const FISH = 6;
const LID_SHARE = 0.22;

type Mode = 'real' | 'sank';
type Fish = { x: number; depth: number; v: number; trapped: boolean; reach: number };

/** Depth of the lake bed at a point across the lake: shallow at the banks, flat in the middle. */
function bed(x: number): number {
  return 1 - (2 * x - 1) ** 4;
}

export default class LakeSim extends BaseSim {
  private mode: Mode = 'real';
  private ice = 0;
  private fish: Fish[] = [];
  private announced = false;

  protected setup(config: Record<string, unknown>): void {
    this.mode = config.mode === 'sank' ? 'sank' : 'real';
    this.ice = 0;
    this.announced = false;
    this.fish = Array.from({ length: FISH }, (_, i) => {
      const depth = 0.34 + ((i + this.env.random() * 0.6) / FISH) * 0.5;
      // Fish only swim where the water is deeper than they are.
      const reach = Math.max(0.05, Math.min(0.4, Math.max(0, 1 - depth - 0.08) ** 0.25 / 2 - 0.04));
      return {
        x: 0.5 + (this.env.random() - 0.5) * reach,
        depth,
        v: (this.env.random() < 0.5 ? -1 : 1) * (0.05 + this.env.random() * 0.05),
        trapped: false,
        reach,
      };
    });
  }

  override setParam(key: string, value: SimValue): void {
    if (key !== 'mode' || (value !== 'real' && value !== 'sank') || value === this.mode) return;
    this.mode = value;
    this.ice = 0;
    this.announced = false;
    for (const fish of this.fish) fish.trapped = false;
  }

  step(dt: number): void {
    const h = Math.min(Math.max(dt, 0), 0.05);
    this.time += h;
    const limit = this.mode === 'real' ? LID_SHARE : 1;
    this.ice = Math.min(limit, this.ice + h * (this.mode === 'real' ? 0.08 : 0.12));
    if (!this.announced && this.ice >= limit) {
      this.announced = true;
      this.emit({ type: 'froze', value: this.mode === 'real' ? 'lid' : 'solid' });
    }
    const iceTop = 1 - this.ice; // only meaningful when ice sinks
    this.fish.forEach((fish, index) => {
      if (!fish.trapped && this.mode === 'sank' && fish.depth > iceTop) {
        fish.trapped = true;
        this.emit({ type: 'trapped', value: index });
      }
      if (fish.trapped) return;
      fish.x += fish.v * h;
      const min = 0.5 - fish.reach;
      const max = 0.5 + fish.reach;
      if (fish.x < min) {
        fish.x = min;
        fish.v = Math.abs(fish.v);
      } else if (fish.x > max) {
        fish.x = max;
        fish.v = -Math.abs(fish.v);
      }
    });
  }

  fishSnapshot(): { x: number; depth: number; trapped: boolean }[] {
    return this.fish.map(({ x, depth, trapped }) => ({ x, depth, trapped }));
  }

  override getState(): SimState {
    return {
      mode: this.mode,
      iceShare: Number(this.ice.toFixed(3)),
      fishSwimming: this.fish.filter((f) => !f.trapped).length,
    };
  }

  describe(): string {
    const swimming = this.fish.filter((f) => !f.trapped).length;
    return this.env.t(this.mode === 'real' ? 'sim.lake.describeReal' : 'sim.lake.describeSank', {
      swimming,
      total: FISH,
    });
  }

  render(ctx: CanvasRenderingContext2D, view: SimView): void {
    const { width: W, height: H, colors } = view;
    if (W <= 0 || H <= 0) return;
    const top = H * 0.3;
    const deepest = H * 0.92;
    const maxDepth = deepest - top;
    const left = W * 0.05;
    const right = W * 0.95;
    const span = right - left;
    const bedPath = () => {
      ctx.beginPath();
      ctx.moveTo(left, top);
      const steps = 48;
      for (let i = 1; i <= steps; i++) {
        const x = i / steps;
        ctx.lineTo(left + span * x, top + bed(x) * maxDepth);
      }
    };

    ctx.fillStyle = colors.sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = colors.ground;
    ctx.fillRect(0, top, W, H - top);

    ctx.save();
    bedPath();
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = colors.paper;
    ctx.fillRect(left, top, span, maxDepth);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = colors.water;
    ctx.fillRect(left, top, span, maxDepth);
    ctx.globalAlpha = 1;

    const iceFrom = this.mode === 'real' ? top : top + (1 - this.ice) * maxDepth;
    const iceTo = this.mode === 'real' ? top + this.ice * maxDepth : deepest;
    if (iceTo > iceFrom) {
      ctx.fillStyle = '#E3F5FF';
      ctx.fillRect(left, iceFrom, span, iceTo - iceFrom);
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.5;
      const edge = this.mode === 'real' ? iceTo : iceFrom;
      ctx.beginPath();
      ctx.moveTo(left, edge);
      ctx.lineTo(right, edge);
      ctx.stroke();
    }

    const size = Math.max(0.6, Math.min(1.2, W / 620));
    for (const fish of this.fish) {
      const fx = left + span * fish.x;
      const fy = top + fish.depth * maxDepth;
      const dir = fish.v > 0 ? 1 : -1;
      ctx.fillStyle = fish.trapped ? '#B7B7C2' : '#FF8A3D';
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 13 * size, 7 * size, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx - dir * 12 * size, fy);
      ctx.lineTo(fx - dir * 21 * size, fy - 7 * size);
      ctx.lineTo(fx - dir * 21 * size, fy + 7 * size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#16161D';
      ctx.beginPath();
      ctx.arc(fx + dir * 6 * size, fy - 2 * size, 1.6 * size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    bedPath();
    ctx.stroke();

    const swimming = this.fish.filter((f) => !f.trapped).length;
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.ink;
    ctx.font = `700 15px ${FONT_BODY}`;
    ctx.fillText(this.env.t(this.mode === 'real' ? 'sim.lake.real' : 'sim.lake.pretend'), 14, 24);
    ctx.font = `500 13px ${FONT_MONO}`;
    ctx.fillText(this.env.t('sim.lake.fish', { swimming, total: FISH }), 14, 44);
  }
}
