import { lessonSchema } from './schema';
import { lessonFixture } from './schema.fixture';

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function withChange(change: (lesson: Any) => void) {
  const lesson = lessonFixture() as Any;
  change(lesson);
  return lessonSchema.safeParse(lesson);
}

function messages(result: ReturnType<typeof lessonSchema.safeParse>): string {
  return result.success
    ? ''
    : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
}

describe('lessonSchema', () => {
  it('accepts a complete lesson', () => {
    const result = lessonSchema.safeParse(lessonFixture());
    expect(messages(result)).toBe('');
    expect(result.success).toBe(true);
  });

  it('rejects an on-screen title longer than 12 words', () => {
    const result = withChange((l) => {
      l.steps[0].title = 'one two three four five six seven eight nine ten eleven twelve thirteen';
    });
    expect(messages(result)).toMatch(/12 words/);
  });

  it('checks the word limit at every depth', () => {
    const result = withChange((l) => {
      l.steps[0].title = { play: 'Short', deep: 'a b c d e f g h i j k l m n' };
    });
    expect(messages(result)).toMatch(/12 words/);
  });

  it('rejects steps out of the fixed order', () => {
    const result = withChange((l) => {
      [l.steps[1], l.steps[2]] = [l.steps[2], l.steps[1]];
    });
    expect(messages(result)).toMatch(/hook, poke, predict, zoom, name_it, challenge, keep/);
  });

  it('rejects a predict answer that is not one of the choices', () => {
    const result = withChange((l) => {
      l.steps[2].answer = 'huge';
    });
    expect(messages(result)).toMatch(/answer/);
  });

  it('rejects a clue that highlights a choice that does not exist', () => {
    const result = withChange((l) => {
      l.steps[2].hints[1].highlight = 'nope';
    });
    expect(messages(result)).toMatch(/highlight/);
  });

  it('needs exactly three predict choices and at least two hints', () => {
    expect(withChange((l) => l.steps[2].choices.pop()).success).toBe(false);
    expect(withChange((l) => (l.steps[2].hints = [l.steps[2].hints[0]])).success).toBe(false);
  });

  it('rejects a lesson with no thread', () => {
    expect(withChange((l) => (l.threads = [])).success).toBe(false);
  });

  it('rejects a lesson with no facts or a fact without a source', () => {
    expect(withChange((l) => (l.facts = [])).success).toBe(false);
    expect(withChange((l) => (l.facts = [{ text: 'x' }])).success).toBe(false);
  });

  it('rejects any learner-facing string that says "wrong"', () => {
    const result = withChange((l) => {
      l.steps[2].hints[0].play = 'Wrong! Try again.';
    });
    expect(messages(result)).toMatch(/not quite/i);
    expect(withChange((l) => (l.steps[0].lumi.play = 'That is the wrong way round.')).success).toBe(
      false,
    );
  });

  it('allows words that merely contain those letters', () => {
    expect(withChange((l) => (l.steps[0].lumi.play = 'A wrongfooted fish.')).success).toBe(true);
  });

  it('rejects text with neither a Play nor an Explain form', () => {
    expect(withChange((l) => (l.steps[0].lumi = { mood: 'wow', deep: 'Only deep.' })).success).toBe(
      false,
    );
  });

  it('rejects a sort item filed under an unknown bin', () => {
    expect(withChange((l) => (l.steps[5].sort.items[0].bin = 'hovers')).success).toBe(false);
  });

  it('rejects a done_when that does not parse', () => {
    const result = withChange((l) => (l.steps[1].done_when = 'count('));
    expect(messages(result)).toMatch(/done_when/);
  });

  it('requires a done_when on poke and zoom', () => {
    expect(withChange((l) => delete l.steps[3].done_when).success).toBe(false);
  });

  it('rejects an unknown subject or a slider whose start is out of range', () => {
    expect(withChange((l) => (l.subject = 'history')).success).toBe(false);
    expect(withChange((l) => (l.steps[3].controls[0].start = 40)).success).toBe(false);
  });
});
