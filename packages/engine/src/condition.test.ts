import { ConditionError, evaluate, parseCondition } from './condition';
import { EventBus } from './events';

function run(
  source: string,
  setup?: (bus: EventBus) => void,
  state: Record<string, number | string | boolean> = {},
) {
  const bus = new EventBus();
  setup?.(bus);
  return evaluate(parseCondition(source), { bus, state });
}

describe('done_when evaluator', () => {
  const poke = "count(dropped) >= 3 && has(dropped, 'ice')";

  it('is true once three things including ice are dropped', () => {
    expect(
      run(poke, (b) => {
        for (const v of ['coin', 'cork', 'ice']) b.emit({ type: 'dropped', value: v });
      }),
    ).toBe(true);
  });

  it('is false with three drops but no ice', () => {
    expect(
      run(poke, (b) => {
        for (const v of ['coin', 'cork', 'apple']) b.emit({ type: 'dropped', value: v });
      }),
    ).toBe(false);
  });

  it('is false with ice but only two drops', () => {
    expect(
      run(poke, (b) => {
        for (const v of ['coin', 'ice']) b.emit({ type: 'dropped', value: v });
      }),
    ).toBe(false);
  });

  it('accepts quoted event names in calls', () => {
    expect(run("count('dropped') >= 1", (b) => b.emit({ type: 'dropped', value: 'ice' }))).toBe(
      true,
    );
  });

  it('checks event occurrence', () => {
    expect(run("event('froze')")).toBe(false);
    expect(run("event('froze')", (b) => b.emit({ type: 'froze' }))).toBe(true);
    expect(run("!event('died')")).toBe(true);
  });

  it('reads simulation state by identifier and by state()', () => {
    expect(run('temperature <= 0', undefined, { temperature: -4 })).toBe(true);
    expect(run('temperature <= 0', undefined, { temperature: 3 })).toBe(false);
    expect(run("state('mode') == 'sank'", undefined, { mode: 'sank' })).toBe(true);
    expect(run('frozen', undefined, { frozen: true })).toBe(true);
  });

  it('treats unknown identifiers as zero', () => {
    expect(run('missing > 0')).toBe(false);
    expect(run('missing == 0')).toBe(true);
  });

  it('binds && tighter than ||', () => {
    expect(run('1 == 1 || 1 == 2 && 1 == 3')).toBe(true);
    expect(run('(1 == 1 || 1 == 2) && 1 == 3')).toBe(false);
  });

  it('supports every comparison operator and negative numbers', () => {
    expect(run('2 > 1 && 1 < 2 && 2 >= 2 && 2 <= 2 && 1 != 2 && 1.5 == 1.5')).toBe(true);
    expect(run('t < -1', undefined, { t: -3 })).toBe(true);
  });

  it.each([
    ['count(', 6],
    ['1 +', 2],
    ['foo(1)', 0],
    ["'open", 0],
    ['', 0],
    ['1 == 1 )', 7],
    ['has(dropped)', 0],
  ])('rejects %j with a position', (source, position) => {
    let error: unknown;
    try {
      parseCondition(source);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConditionError);
    expect((error as ConditionError).position).toBe(position);
  });
});
