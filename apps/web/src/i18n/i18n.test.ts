import { createTranslator } from './index';

describe('translator', () => {
  const t = createTranslator({
    hello: 'Hello',
    step: 'Step {current} of {total}',
    nested: { deep: 'Deep value' },
  });

  it('looks up flat and nested keys', () => {
    expect(t('hello')).toBe('Hello');
    expect(t('nested.deep')).toBe('Deep value');
  });

  it('fills in variables', () => {
    expect(t('step', { current: 4, total: 7 })).toBe('Step 4 of 7');
  });

  it('leaves unknown placeholders visible and returns the key when a string is missing', () => {
    expect(t('step', { current: 4 })).toBe('Step 4 of {total}');
    expect(t('missing.key')).toBe('missing.key');
    expect(t('nested')).toBe('nested');
  });
});
