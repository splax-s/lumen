import { createNarration } from './narration';

class FakeUtterance {
  rate = 1;
  pitch = 1;
  lang = '';
  onend: (() => void) | null = null;
  constructor(public text: string) {}
}

function fakeSynth() {
  const spoken: FakeUtterance[] = [];
  let cancels = 0;
  return {
    spoken,
    cancels: () => cancels,
    synth: {
      speak: (u: FakeUtterance) => spoken.push(u),
      cancel: () => {
        cancels++;
      },
    },
  };
}

describe('narration', () => {
  it('reports unavailable and stays silent when the browser cannot speak', () => {
    const narration = createNarration({ synth: undefined, Utterance: undefined });
    expect(narration.available()).toBe(false);
    expect(() => narration.speak('Hello')).not.toThrow();
    expect(() => narration.stop()).not.toThrow();
  });

  it('speaks through speech synthesis, stopping whatever was playing', () => {
    const fake = fakeSynth();
    const narration = createNarration({ synth: fake.synth, Utterance: FakeUtterance });
    expect(narration.available()).toBe(true);
    narration.speak('Ice floats.');
    expect(fake.cancels()).toBe(1);
    expect(fake.spoken).toHaveLength(1);
    expect(fake.spoken[0]).toMatchObject({ text: 'Ice floats.', rate: 0.95, lang: 'en' });
  });

  it('does not speak empty text', () => {
    const fake = fakeSynth();
    const narration = createNarration({ synth: fake.synth, Utterance: FakeUtterance });
    narration.speak('   ');
    expect(fake.spoken).toHaveLength(0);
  });

  it('prefers a recording when one exists for the line', () => {
    const fake = fakeSynth();
    const played: string[] = [];
    const narration = createNarration({
      synth: fake.synth,
      Utterance: FakeUtterance,
      recordings: { 'chem.ice-floats.0.play': '/audio/ice-0-play.mp3' },
      playAudio: (url) => {
        played.push(url);
        return { stop: () => {} };
      },
    });
    narration.speak('Look!', 'chem.ice-floats.0.play');
    expect(played).toEqual(['/audio/ice-0-play.mp3']);
    expect(fake.spoken).toHaveLength(0);
    narration.speak('Other', 'chem.ice-floats.9.play');
    expect(fake.spoken).toHaveLength(1);
  });

  it('survives a speech engine that throws', () => {
    const narration = createNarration({
      synth: {
        speak: () => {
          throw new Error('not allowed');
        },
        cancel: () => {
          throw new Error('not allowed');
        },
      },
      Utterance: FakeUtterance,
    });
    expect(() => narration.speak('Hello')).not.toThrow();
    expect(() => narration.stop()).not.toThrow();
  });
});
