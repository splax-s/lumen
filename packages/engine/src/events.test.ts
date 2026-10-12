import { EventBus } from './events';

describe('EventBus', () => {
  it('counts distinct values for events that carry values', () => {
    const bus = new EventBus();
    bus.emit({ type: 'dropped', value: 'coin' });
    bus.emit({ type: 'dropped', value: 'coin' });
    bus.emit({ type: 'dropped', value: 'ice' });
    expect(bus.count('dropped')).toBe(2);
  });

  it('counts occurrences for events without values', () => {
    const bus = new EventBus();
    bus.emit({ type: 'collided' });
    bus.emit({ type: 'collided' });
    expect(bus.count('collided')).toBe(2);
    expect(bus.count('never')).toBe(0);
  });

  it('answers has and seen', () => {
    const bus = new EventBus();
    bus.emit({ type: 'dropped', value: 'ice' });
    expect(bus.has('dropped', 'ice')).toBe(true);
    expect(bus.has('dropped', 'coin')).toBe(false);
    expect(bus.seen('dropped')).toBe(true);
    expect(bus.seen('froze')).toBe(false);
  });

  it('stops notifying a listener once it unsubscribes', () => {
    const bus = new EventBus();
    const got: string[] = [];
    const off = bus.on((e) => got.push(e.type));
    bus.emit({ type: 'a' });
    off();
    bus.emit({ type: 'b' });
    expect(got).toEqual(['a']);
  });

  it('keeps an ordered log and clears it', () => {
    const bus = new EventBus();
    bus.emit({ type: 'dropped', value: 'ice' });
    bus.emit({ type: 'settled', value: 'ice' });
    expect(bus.log().map((e) => e.type)).toEqual(['dropped', 'settled']);
    bus.clear();
    expect(bus.log()).toHaveLength(0);
    expect(bus.seen('dropped')).toBe(false);
  });

  it('a throwing listener does not stop other listeners', () => {
    const bus = new EventBus();
    let reached = false;
    bus.on(() => {
      throw new Error('boom');
    });
    bus.on(() => {
      reached = true;
    });
    expect(() => bus.emit({ type: 'a' })).not.toThrow();
    expect(reached).toBe(true);
  });
});
