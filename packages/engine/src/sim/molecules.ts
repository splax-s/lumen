import {
  BaseSim,
  FONT_MONO,
  TAU,
  caption,
  type SimState,
  type SimValue,
  type SimView,
} from './types';

/**
 * Water molecules cooling into ice. As a liquid they sit close together with no pattern.
 * Below 0 °C each one bonds to three neighbours in six-sided rings (a flat picture of ice Ih),
 * and that open pattern needs about 9% more room.
 */

const BOND = 26; // distance between bonded oxygens, in sim units
const COLS = 6;
const ROWS = 4;
const HOH_ANGLE = 104.5;
const EXPANSION = 0.09;
const PAD = BOND;

type Site = { x: number; y: number; sub: 0 | 1 };
type Molecule = {
  site: Site;
  liquid: { x: number; y: number };
  phase: number;
  rate: number;
  angle: number;
  spin: number;
};

export default class MoleculesSim extends BaseSim {
  private molecules: Molecule[] = [];
  private bonds: [number, number][] = [];
  private spanX = 0;
  private spanY = 0;
  private temperature = 20;
  /** 0 is fully liquid, 1 fully frozen. */
  private frozen = 0;
  private isFrozen = false;

  protected setup(config: Record<string, unknown>): void {
    this.temperature = typeof config.temperature === 'number' ? config.temperature : 20;
    this.frozen = 0;
    this.isFrozen = false;

    const sites: Site[] = [];
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const x = i * Math.sqrt(3) * BOND + (j % 2) * ((Math.sqrt(3) * BOND) / 2);
        const y = j * 1.5 * BOND;
        sites.push({ x, y, sub: 0 }, { x, y: y + BOND, sub: 1 });
      }
    }
    const xs = sites.map((s) => s.x);
    const ys = sites.map((s) => s.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    for (const site of sites) {
      site.x -= (minX + maxX) / 2;
      site.y -= (minY + maxY) / 2;
    }
    this.spanX = maxX - minX;
    this.spanY = maxY - minY;

    this.bonds = [];
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        if (Math.hypot(sites[i]!.x - sites[j]!.x, sites[i]!.y - sites[j]!.y) < BOND * 1.05)
          this.bonds.push([i, j]);
      }
    }

    // Liquid positions: the same molecules packed closer, on a loose grid with random offsets.
    const liquidW = (this.spanX + PAD * 2) / (1 + EXPANSION) - PAD * 1.5;
    const liquidH = this.spanY + PAD * 2 - PAD * 1.5;
    const gridCols = 8;
    const gridRows = sites.length / gridCols;
    const free: { x: number; y: number }[] = [];
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const jitterX = (this.env.random() - 0.5) * 0.3;
        const jitterY = (this.env.random() - 0.5) * 0.3;
        free.push({
          x: ((c + 0.5 + (r % 2 ? 0.2 : -0.2) + jitterX) / gridCols - 0.5) * liquidW,
          y: ((r + 0.5 + jitterY) / gridRows - 0.5) * liquidH,
        });
      }
    }
    this.molecules = sites.map((site) => {
      let best = 0;
      let bestDistance = Infinity;
      free.forEach((p, index) => {
        const d = (p.x - site.x) ** 2 + (p.y - site.y) ** 2;
        if (d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      });
      const liquid = free.splice(best, 1)[0]!;
      return {
        site,
        liquid,
        phase: this.env.random() * TAU,
        rate: 1.5 + this.env.random() * 2,
        angle: this.env.random() * TAU,
        spin: (this.env.random() - 0.5) * 3,
      };
    });
  }

  override setParam(key: string, value: SimValue): void {
    if (key === 'temperature' && typeof value === 'number' && Number.isFinite(value))
      this.temperature = value;
  }

  step(dt: number): void {
    const h = Math.min(Math.max(dt, 0), 0.05);
    this.time += h;
    const target = this.temperature < 0 ? 1 : 0;
    this.frozen += (target - this.frozen) * Math.min(1, h * 2.2);
    for (const m of this.molecules) m.angle += m.spin * h * (1 - this.frozen);
    if (!this.isFrozen && this.frozen > 0.95) {
      this.isFrozen = true;
      this.emit({ type: 'froze' });
    } else if (this.isFrozen && this.frozen < 0.05) {
      this.isFrozen = false;
      this.emit({ type: 'melted' });
    }
  }

  override getState(): SimState {
    return {
      temperature: this.temperature,
      frozen: this.isFrozen,
      space: Math.round(100 + EXPANSION * 100 * this.frozen),
      molecules: this.molecules.length,
    };
  }

  /** How many bonded neighbours each lattice position has. */
  bondCounts(): number[] {
    const counts = this.molecules.map(() => 0);
    for (const [a, b] of this.bonds) {
      counts[a]! += 1;
      counts[b]! += 1;
    }
    return counts;
  }

  bondAngleDegrees(): number {
    return HOH_ANGLE;
  }

  describe(): string {
    const t = this.env.t;
    const vars = {
      temperature: this.temperature,
      percent: Math.round(100 + EXPANSION * 100 * this.frozen),
    };
    return this.frozen > 0.5
      ? t('sim.molecules.describeIce', vars)
      : t('sim.molecules.describeLiquid', vars);
  }

  render(ctx: CanvasRenderingContext2D, view: SimView): void {
    const { width: W, height: H, colors } = view;
    if (W <= 0 || H <= 0) return;
    const f = this.frozen;
    const fullW = this.spanX + PAD * 2;
    const fullH = this.spanY + PAD * 2;
    const scale = Math.max(0.05, Math.min((W - 32) / fullW, (H - 86) / fullH));
    const cx = W / 2;
    const cy = H / 2;

    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, W, H);

    const boxW = (fullW / (1 + EXPANSION)) * (1 + EXPANSION * f) * scale;
    const boxH = fullH * scale;
    ctx.fillStyle = colors.mist;
    ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

    const percent = Math.round(100 + EXPANSION * 100 * f);
    ctx.font = `500 14px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    const readout = this.env.t('sim.molecules.space', { percent });
    if (percent > 100) {
      const w = ctx.measureText(readout).width + 14;
      ctx.fillStyle = colors.lumi;
      ctx.fillRect(cx - w / 2, cy - boxH / 2 - 27, w, 20);
    }
    ctx.fillStyle = '#16161D';
    if (percent === 100) ctx.fillStyle = colors.ink;
    ctx.fillText(readout, cx, cy - boxH / 2 - 12);

    const calm = this.env.reducedMotion ? 0.3 : 1;
    const amplitude =
      ((1 - f) * (3 + Math.max(0, this.temperature) * 0.22) + f * 0.8) * calm * scale;
    const positions = this.molecules.map((m) => ({
      x:
        cx +
        (m.liquid.x * (1 - f) + m.site.x * f) * scale +
        Math.sin(this.time * m.rate + m.phase) * amplitude,
      y:
        cy +
        (m.liquid.y * (1 - f) + m.site.y * f) * scale +
        Math.cos(this.time * m.rate * 1.3 + m.phase) * amplitude,
    }));

    if (f > 0.3) {
      ctx.globalAlpha = (f - 0.3) / 0.7;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.25;
      for (const [a, b] of this.bonds) {
        ctx.beginPath();
        ctx.moveTo(positions[a]!.x, positions[a]!.y);
        ctx.lineTo(positions[b]!.x, positions[b]!.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    const r = Math.max(3, BOND * 0.24 * scale);
    const hr = r * 0.55;
    const hd = r * 1.15;
    const half = ((HOH_ANGLE / 2) * Math.PI) / 180;
    ctx.lineWidth = Math.max(1, Math.min(1.5, r / 5));
    this.molecules.forEach((m, index) => {
      const base = m.site.sub ? Math.PI / 2 : -Math.PI / 2;
      const angle = m.angle * (1 - f) + base * f;
      const p = positions[index]!;
      ctx.strokeStyle = colors.ink;
      for (const side of [-1, 1]) {
        const a = angle + side * half;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * hd, p.y + Math.sin(a) * hd, hr, 0, TAU);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fillStyle = '#E5484D';
      ctx.fill();
      ctx.stroke();
    });

    ctx.textAlign = 'left';
    ctx.font = `500 12px ${FONT_MONO}`;
    ctx.fillStyle = colors.graphite;
    caption(ctx, this.env.t(`sim.molecules.legend.${this.env.depth()}`), 12, H - 10, W - 24, 15);
  }
}
