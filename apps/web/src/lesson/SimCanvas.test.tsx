import { act, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { EventBus } from '@lumen/engine';
import { SimCanvas, type SimHandle } from './SimCanvas';

function fakeContext(): CanvasRenderingContext2D {
  return new Proxy(
    {},
    {
      get: (_t, prop) => (prop === 'measureText' ? () => ({ width: 10 }) : () => {}),
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
}

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let cancelled: number[];

beforeEach(() => {
  frames = new Map();
  nextFrame = 1;
  cancelled = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext() as never);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(nextFrame, cb);
    return nextFrame++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id);
    frames.delete(id);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function runFrames(count: number, start = 0) {
  for (let i = 0; i < count; i++) {
    const pending = [...frames.entries()];
    frames.clear();
    for (const [, cb] of pending) cb(start + (i + 1) * 16);
  }
}

describe('SimCanvas', () => {
  it('loads the simulation and describes it for screen readers', async () => {
    const bus = new EventBus();
    render(<SimCanvas spec={{ kind: 'tank', items: ['ice', 'stone'] }} bus={bus} depth="play" label="A water tank" />);
    const figure = await screen.findByRole('img', { name: /A water tank/ });
    await waitFor(() => expect(figure.getAttribute('aria-label')).toMatch(/ice cube floats/));
  });

  it('forwards parameters to the simulation, including ones sent before it has loaded', async () => {
    const bus = new EventBus();
    const ref = createRef<SimHandle>();
    render(<SimCanvas ref={ref} spec={{ kind: 'tank' }} bus={bus} depth="play" label="A water tank" />);
    act(() => ref.current!.setParam('drop', 'coin'));
    await waitFor(() => expect(bus.has('dropped', 'coin')).toBe(true));
    act(() => ref.current!.setParam('drop', 'ice'));
    expect(bus.has('dropped', 'ice')).toBe(true);
  });

  it('reports simulation state as it changes', async () => {
    const bus = new EventBus();
    const ref = createRef<SimHandle>();
    const states: Record<string, unknown>[] = [];
    render(
      <SimCanvas ref={ref} spec={{ kind: 'tank' }} bus={bus} depth="play" label="Tank" onState={(s) => states.push(s)} />,
    );
    await waitFor(() => expect(states.length).toBeGreaterThan(0));
    expect(states.at(-1)).toMatchObject({ count: 0 });
    act(() => ref.current!.setParam('drop', 'coin'));
    act(() => runFrames(40));
    expect(states.at(-1)).toMatchObject({ count: 1 });
  });

  it('stops its animation loop when removed', async () => {
    const bus = new EventBus();
    const { unmount } = render(<SimCanvas spec={{ kind: 'tank' }} bus={bus} depth="play" label="Tank" />);
    await waitFor(() => expect(frames.size).toBe(1));
    unmount();
    expect(frames.size).toBe(0);
    expect(cancelled.length).toBeGreaterThan(0);
  });

  it('shows a message instead of crashing when the simulation kind is unknown', async () => {
    const bus = new EventBus();
    render(<SimCanvas spec={{ kind: 'volcano' }} bus={bus} depth="play" label="Volcano" />);
    expect(await screen.findByText(/could not start/)).toBeInTheDocument();
  });

  it('shows a message when the browser gives no drawing context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    const bus = new EventBus();
    render(<SimCanvas spec={{ kind: 'tank' }} bus={bus} depth="play" label="Tank" />);
    expect(await screen.findByText(/could not start/)).toBeInTheDocument();
  });
});
