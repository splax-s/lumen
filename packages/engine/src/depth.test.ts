import { resolveText } from './depth';

describe('resolveText', () => {
  const full = { play: 'P', explain: 'E', deep: 'D' };

  it('returns the selected depth when present', () => {
    expect(resolveText(full, 'play')).toBe('P');
    expect(resolveText(full, 'explain')).toBe('E');
    expect(resolveText(full, 'deep')).toBe('D');
  });

  it('falls back from deep to explain, then play', () => {
    expect(resolveText({ play: 'P', explain: 'E' }, 'deep')).toBe('E');
    expect(resolveText({ play: 'P' }, 'deep')).toBe('P');
  });

  it('falls back from play to explain when play is missing', () => {
    expect(resolveText({ explain: 'E', deep: 'D' }, 'play')).toBe('E');
  });

  it('passes plain strings through and returns empty for nothing', () => {
    expect(resolveText('same', 'deep')).toBe('same');
    expect(resolveText({}, 'play')).toBe('');
  });
});
