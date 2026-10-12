import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  createRandom,
  loadSimulation,
  type Depth,
  type EventBus,
  type SimColors,
  type SimSpec,
  type SimState,
  type SimValue,
  type Simulation,
  type SimView,
} from '@lumen/engine';
import { t } from '../i18n';
import styles from './SimCanvas.module.css';

export type SimHandle = { setParam(key: string, value: SimValue): void };

export type SimCanvasProps = {
  spec: SimSpec;
  bus: EventBus;
  depth: Depth;
  /** What the picture is, for people who cannot see it. The simulation adds its current state. */
  label: string;
  /** Values applied as soon as the simulation starts, such as slider positions. */
  initialParams?: Record<string, SimValue>;
  onState?: (state: SimState) => void;
  className?: string;
};

const FALLBACK: SimColors = {
  ink: '#16161D',
  paper: '#FFFFFF',
  mist: '#F6F6F8',
  line: '#E6E6EC',
  graphite: '#55555F',
  water: '#8FCFF2',
  sky: '#EEF5FC',
  ground: '#E3F1D9',
  accent: '#16161D',
  lumi: '#FFC21A',
};

const TOKENS: Record<keyof SimColors, string> = {
  ink: '--lm-ink',
  paper: '--lm-white',
  mist: '--lm-mist',
  line: '--lm-line',
  graphite: '--lm-graphite',
  water: '--lm-sim-water',
  sky: '--lm-sim-sky',
  ground: '--lm-sim-ground',
  accent: '--lm-accent',
  lumi: '--lm-lumi',
};

function readColors(element: Element): SimColors {
  const style = getComputedStyle(element);
  const colors = { ...FALLBACK };
  for (const key of Object.keys(TOKENS) as (keyof SimColors)[]) {
    const value = style.getPropertyValue(TOKENS[key]).trim();
    if (value) colors[key] = value;
  }
  return colors;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** How much simulated time to skip ahead when motion is reduced, so results appear without animation. */
const SETTLE_STEPS = 240;
const STATE_INTERVAL = 0.15;

type FrameProbe = { __lumenFrames?: number[] };

/**
 * Hosts one simulation on a canvas: loads it, sizes the canvas, runs the frame loop,
 * and reports the simulation's state back to the lesson.
 */
export const SimCanvas = forwardRef<SimHandle, SimCanvasProps>(function SimCanvas(
  { spec, bus, depth, label, initialParams, onState, className },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation | null>(null);
  const queueRef = useRef<[string, SimValue][]>([]);
  const settleRef = useRef<() => void>(() => {});
  const depthRef = useRef(depth);
  const onStateRef = useRef(onState);
  const initialRef = useRef(initialParams);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    depthRef.current = depth;
    onStateRef.current = onState;
  }, [depth, onState]);

  useImperativeHandle(
    ref,
    () => ({
      setParam(key, value) {
        const sim = simRef.current;
        if (!sim) {
          queueRef.current.push([key, value]);
          return;
        }
        sim.setParam(key, value);
        settleRef.current();
      },
    }),
    [],
  );

  const specKey = JSON.stringify(spec);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let stopped = false;
    let frame = 0;
    let cleanup = () => {};
    setStatus('loading');

    const parsed = JSON.parse(specKey) as SimSpec;
    const { kind, ...config } = parsed;

    loadSimulation(kind)
      .then((SimClass) => {
        if (stopped) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        const reducedMotion = prefersReducedMotion();
        const sim = new SimClass();
        sim.init(config, {
          bus,
          depth: () => depthRef.current,
          random: createRandom((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0),
          reducedMotion,
          t,
        });
        for (const [key, value] of Object.entries(initialRef.current ?? {}))
          sim.setParam(key, value);
        for (const [key, value] of queueRef.current) sim.setParam(key, value);
        queueRef.current = [];

        const settle = () => {
          if (!reducedMotion) return;
          for (let i = 0; i < SETTLE_STEPS; i++) sim.step(1 / 60);
        };
        settle();
        settleRef.current = settle;
        simRef.current = sim;

        let colors = readColors(wrap);
        let width = 0;
        let height = 0;
        let ratio = 1;
        const measure = () => {
          const rect = wrap.getBoundingClientRect();
          width = Math.max(0, rect.width);
          height = Math.max(0, rect.height);
          ratio = Math.min(2, window.devicePixelRatio || 1);
          const w = Math.round(width * ratio);
          const h = Math.round(height * ratio);
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
        };
        measure();
        const resizeObserver =
          typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        resizeObserver?.observe(wrap);
        window.addEventListener('resize', measure);

        // Colours follow the theme, so re-read them when it changes.
        const themeObserver =
          typeof MutationObserver !== 'undefined'
            ? new MutationObserver(() => {
                colors = readColors(wrap);
              })
            : null;
        themeObserver?.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        });

        let lastState = '';
        let lastDescription = '';
        const report = () => {
          const state = sim.getState();
          const key = JSON.stringify(state);
          if (key !== lastState) {
            lastState = key;
            onStateRef.current?.(state);
          }
          const text = sim.describe();
          if (text !== lastDescription) {
            lastDescription = text;
            setDescription(text);
          }
        };
        report();

        let last: number | null = null;
        let sinceReport = 0;
        let elapsed = 0;
        const view = (): SimView => ({ width, height, colors, time: elapsed });
        const tick = (now: number) => {
          if (stopped) return;
          const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
          const probe = (window as unknown as FrameProbe).__lumenFrames;
          if (probe && last !== null) probe.push(now - last);
          last = now;
          elapsed += dt;
          sim.step(dt);
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          sim.render(ctx, view());
          sinceReport += dt;
          if (sinceReport >= STATE_INTERVAL) {
            sinceReport = 0;
            report();
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        // A hidden tab pauses frames; forget the old timestamp so time does not jump on return.
        const onVisibility = () => {
          last = null;
        };
        document.addEventListener('visibilitychange', onVisibility);

        const point = (kind: 'down' | 'move' | 'up') => (event: PointerEvent) => {
          if (!sim.pointer) return;
          const rect = canvas.getBoundingClientRect();
          sim.pointer(kind, event.clientX - rect.left, event.clientY - rect.top, view());
          if (kind !== 'move') settle();
        };
        const down = point('down');
        const move = point('move');
        const up = point('up');
        if (sim.pointer) {
          canvas.style.touchAction = 'none';
          canvas.addEventListener('pointerdown', down);
          canvas.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }

        cleanup = () => {
          resizeObserver?.disconnect();
          themeObserver?.disconnect();
          window.removeEventListener('resize', measure);
          document.removeEventListener('visibilitychange', onVisibility);
          canvas.removeEventListener('pointerdown', down);
          canvas.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          sim.destroy?.();
        };
        setStatus('ready');
      })
      .catch(() => {
        if (!stopped) setStatus('failed');
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      cleanup();
      simRef.current = null;
      settleRef.current = () => {};
    };
  }, [specKey, bus]);

  const fullLabel = description ? `${label}. ${description}` : label;

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={status === 'loading' ? `${label}. ${t('sim.loading')}` : fullLabel}
      className={[styles.wrap, className ?? ''].filter(Boolean).join(' ')}
      data-sim={spec.kind}
      data-status={status}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {status === 'failed' ? <p className={styles.failed}>{t('sim.failed')}</p> : null}
    </div>
  );
});
