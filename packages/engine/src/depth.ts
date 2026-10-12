export type Depth = 'play' | 'explain' | 'deep';
export const DEPTHS: readonly Depth[] = ['play', 'explain', 'deep'];

export type Mood = 'happy' | 'thinking' | 'wow' | 'proud';
export const MOODS: readonly Mood[] = ['happy', 'thinking', 'wow', 'proud'];

export type DepthText =
  string | { play?: string | undefined; explain?: string | undefined; deep?: string | undefined };

/** Selected depth first, then Explain, then Play. */
export function resolveText(text: DepthText | undefined, depth: Depth): string {
  if (text === undefined) return '';
  if (typeof text === 'string') return text;
  return text[depth] ?? text.explain ?? text.play ?? text.deep ?? '';
}
