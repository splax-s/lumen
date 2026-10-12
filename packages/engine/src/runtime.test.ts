import { resolveText } from './depth';
import { LessonRuntime } from './runtime';
import { lessonSchema } from './schema';
import { lessonFixture } from './schema.fixture';

const lesson = lessonSchema.parse(lessonFixture());

function start(depth: 'play' | 'explain' | 'deep' = 'play') {
  let clock = 1000;
  const runtime = new LessonRuntime(lesson, { depth, now: () => clock, newId: () => 'attempt-1' });
  return {
    runtime,
    tick: (ms = 1000) => {
      clock += ms;
    },
    said: () => resolveText(runtime.getState().lumi.text, runtime.getState().depth),
    goTo(type: string) {
      for (let guard = 0; guard < 20 && runtime.getState().step.type !== type; guard++) {
        const s = runtime.getState();
        if (s.step.type === 'poke') for (const v of ['coin', 'cork', 'ice']) runtime.bus.emit({ type: 'dropped', value: v });
        if (s.step.type === 'predict') runtime.answerPredict('bigger');
        if (s.step.type === 'zoom') runtime.bus.emit({ type: 'froze' });
        if (s.step.type === 'challenge') {
          runtime.answerSort('log', 'floats');
          runtime.answerSort('stone', 'sinks');
          runtime.setToggle(true);
        }
        clock += 1000;
        expect(runtime.next()).toBe(true);
      }
      expect(runtime.getState().step.type).toBe(type);
    },
  };
}

describe('LessonRuntime', () => {
  it('starts on the hook, ready, with the hook line', () => {
    const { runtime, said } = start();
    const s = runtime.getState();
    expect(s.stepIndex).toBe(0);
    expect(s.stepCount).toBe(7);
    expect(s.ready).toBe(true);
    expect(s.lumi.mood).toBe('wow');
    expect(said()).toBe('Ice is hard like a stone.');
  });

  it('keeps poke locked until done_when holds, then stays ready', () => {
    const { runtime, goTo, said } = start();
    goTo('poke');
    expect(runtime.getState().ready).toBe(false);
    expect(runtime.next()).toBe(false);
    runtime.bus.emit({ type: 'dropped', value: 'coin' });
    expect(said()).toBe('Plop!');
    expect(runtime.getState().lumi.mood).toBe('wow');
    runtime.bus.emit({ type: 'dropped', value: 'cork' });
    expect(runtime.getState().ready).toBe(false);
    runtime.bus.emit({ type: 'dropped', value: 'ice' });
    expect(runtime.getState().ready).toBe(true);
    expect(said()).toContain('Tap Continue.');
  });

  it('re-evaluates done_when when simulation state changes', () => {
    const custom = lessonSchema.parse({
      ...lessonFixture(),
      steps: (lessonFixture().steps as Record<string, unknown>[]).map((s) =>
        s.type === 'zoom' ? { ...s, done_when: 'temperature <= 0' } : s,
      ),
    });
    const runtime = new LessonRuntime(custom, { depth: 'play' });
    runtime.jumpTo(3);
    expect(runtime.getState().ready).toBe(false);
    runtime.setSimState({ temperature: -2 });
    expect(runtime.getState().ready).toBe(true);
  });

  it('accepts the right prediction straight away', () => {
    const { runtime, goTo, said } = start();
    goTo('predict');
    expect(runtime.getState().ready).toBe(false);
    expect(runtime.answerPredict('bigger')).toBe('correct');
    const s = runtime.getState();
    expect(s.ready).toBe(true);
    expect(s.hintLevel).toBe(0);
    expect(s.lumi.mood).toBe('proud');
    expect(said()).toBe('Yes!');
  });

  it('walks the ladder: nudge, clue with highlight, demo, then the answer', () => {
    const { runtime, goTo, said } = start();
    goTo('predict');

    expect(runtime.answerPredict('smaller')).toBe('not_quite');
    expect(runtime.getState().hintLevel).toBe(1);
    expect(said()).toBe('Not quite. The ice floated...');
    expect(runtime.getState().lumi.mood).toBe('thinking');
    expect(runtime.getState().highlight).toBeNull();
    expect(runtime.getState().wrongChoices).toEqual(['smaller']);

    expect(runtime.answerPredict('same')).toBe('not_quite');
    expect(runtime.getState().hintLevel).toBe(2);
    expect(runtime.getState().highlight).toBe('bigger');
    expect(runtime.getState().ready).toBe(false);

    runtime.requestHint();
    expect(runtime.getState().hintLevel).toBe(3);
    expect(runtime.getState().demo).toEqual({ kind: 'tank', items: ['ice'], labels: true });
    expect(runtime.getState().ready).toBe(false);

    runtime.requestHint();
    const s = runtime.getState();
    expect(s.hintLevel).toBe(4);
    expect(s.ready).toBe(true);
    expect(s.solved).toBe(true);
    expect(said()).toBe('It takes up more space.');
    expect(runtime.attempt().reviewConcepts).toEqual(['density', 'states-of-matter']);
  });

  it('never shows the answer before two hints', () => {
    const { runtime, goTo } = start();
    goTo('predict');
    runtime.requestHint();
    expect(runtime.getState().solved).toBe(false);
    runtime.requestHint();
    expect(runtime.getState().solved).toBe(false);
    expect(runtime.getState().hintLevel).toBe(2);
  });

  it('ignores a repeated wrong pick and picks after solving', () => {
    const { runtime, goTo } = start();
    goTo('predict');
    runtime.answerPredict('smaller');
    runtime.answerPredict('smaller');
    expect(runtime.getState().hintLevel).toBe(1);
    runtime.answerPredict('bigger');
    runtime.answerPredict('same');
    expect(runtime.getState().wrongChoices).toEqual(['smaller']);
    expect(runtime.attempt().reviewConcepts).toEqual([]);
  });

  it('runs the sort, then unlocks the follow-up, and is ready after the toggle', () => {
    const { runtime, goTo, said } = start();
    goTo('challenge');
    expect(runtime.getState().stage).toBe('sort');
    expect(runtime.answerSort('log', 'sinks')).toBe('not_quite');
    expect(said()).toBe('Not quite! Is a wooden log packed tighter than water?');
    expect(runtime.getState().sorted).toEqual([]);
    expect(runtime.answerSort('log', 'floats')).toBe('correct');
    expect(runtime.answerSort('stone', 'sinks')).toBe('correct');
    expect(runtime.getState().sorted).toEqual(['log', 'stone']);
    expect(runtime.getState().stage).toBe('then');
    expect(said()).toBe('All correct!');
    expect(runtime.getState().ready).toBe(false);
    runtime.setToggle(true);
    expect(said()).toBe('Oh no!');
    expect(runtime.getState().toggleOn).toBe(true);
    expect(runtime.getState().ready).toBe(true);
    runtime.setToggle(false);
    expect(said()).toBe('Phew.');
    expect(runtime.getState().ready).toBe(true);
  });

  it('advances once when Continue is activated twice in quick succession', () => {
    const { runtime, tick } = start();
    tick();
    expect(runtime.next()).toBe(true);
    expect(runtime.next()).toBe(false);
    expect(runtime.getState().stepIndex).toBe(1);
  });

  it('goes back and keeps the earlier step passable', () => {
    const { runtime, goTo } = start();
    goTo('predict');
    runtime.back();
    expect(runtime.getState().step.type).toBe('poke');
    expect(runtime.getState().ready).toBe(true);
    runtime.back();
    runtime.back();
    expect(runtime.getState().stepIndex).toBe(0);
  });

  it('changes text with depth but keeps progress, hints and events', () => {
    const { runtime, goTo, said } = start();
    expect(said()).toBe('Ice is hard like a stone.');
    runtime.setDepth('deep');
    expect(said()).toBe('Water is a rare exception.');
    goTo('predict');
    runtime.answerPredict('smaller');
    runtime.setDepth('explain');
    const s = runtime.getState();
    expect(s.depth).toBe('explain');
    expect(s.hintLevel).toBe(1);
    expect(s.wrongChoices).toEqual(['smaller']);
    expect(s.stepIndex).toBe(2);
  });

  it('keeps the event log when depth changes mid-step', () => {
    const { runtime, goTo } = start();
    goTo('poke');
    runtime.bus.emit({ type: 'dropped', value: 'coin' });
    runtime.setDepth('deep');
    expect(runtime.bus.has('dropped', 'coin')).toBe(true);
  });

  it('finishes on the last step and records the attempt', () => {
    const { runtime, goTo, tick } = start('explain');
    goTo('predict');
    runtime.answerPredict('same');
    goTo('keep');
    expect(runtime.getState().ready).toBe(true);
    tick();
    expect(runtime.next()).toBe(true);
    expect(runtime.getState().finished).toBe(true);
    tick();
    expect(runtime.next()).toBe(false);
    const attempt = runtime.attempt();
    expect(attempt.id).toBe('attempt-1');
    expect(attempt.lessonId).toBe('chem.ice-floats');
    expect(attempt.depth).toBe('explain');
    expect(attempt.finishedAt).not.toBeNull();
    expect(attempt.steps).toHaveLength(7);
    expect(attempt.steps[2]).toMatchObject({ type: 'predict', wrong: 1, hintLevel: 1 });
    expect(attempt.hintsUsed).toBe(1);
    expect(attempt.steps[0]!.ms).toBeGreaterThan(0);
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const { runtime, tick } = start();
    let calls = 0;
    const off = runtime.subscribe(() => calls++);
    tick();
    runtime.next();
    expect(calls).toBeGreaterThan(0);
    const before = calls;
    off();
    runtime.setDepth('deep');
    expect(calls).toBe(before);
  });
});
