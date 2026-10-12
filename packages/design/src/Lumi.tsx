import type { Mood } from '@lumen/engine';
import styles from './Lumi.module.css';

const INK = 'var(--lm-ink-fixed, #16161D)';

const NAMES: Record<Mood, string> = {
  happy: 'Lumi, happy',
  thinking: 'Lumi, thinking',
  wow: 'Lumi, amazed',
  proud: 'Lumi, proud',
};

/** Bulb radius and fill: it dims while thinking and blazes when proud. */
const BULB: Record<Mood, { r: number; fill: string; halo: number }> = {
  happy: { r: 6, fill: '#FFE9A8', halo: 0.22 },
  thinking: { r: 6, fill: '#FFFFFF', halo: 0.1 },
  wow: { r: 7, fill: '#FFE9A8', halo: 0.28 },
  proud: { r: 8, fill: '#FFD75E', halo: 0.45 },
};

function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'thinking':
      return (
        <>
          <ellipse className={styles.eye} cx="35" cy="45" rx="3" ry="4.4" fill={INK} />
          <ellipse className={styles.eye} cx="51" cy="45" rx="3" ry="4.4" fill={INK} />
          <path
            d="M36,64 L45,62"
            fill="none"
            stroke={INK}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      );
    case 'wow':
      return (
        <>
          <circle cx="32" cy="49" r="5" fill="#FFFFFF" stroke={INK} strokeWidth="1.8" />
          <circle cx="48" cy="49" r="5" fill="#FFFFFF" stroke={INK} strokeWidth="1.8" />
          <circle cx="32" cy="49" r="2.4" fill={INK} />
          <circle cx="48" cy="49" r="2.4" fill={INK} />
          <ellipse cx="40" cy="65" rx="4" ry="5" fill={INK} />
        </>
      );
    case 'proud':
      return (
        <>
          <path
            d="M28,52 Q32,46 36,52 M44,52 Q48,46 52,52"
            fill="none"
            stroke={INK}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path d="M32,60 Q40,72 48,60 Z" fill={INK} />
        </>
      );
    default:
      return (
        <>
          <ellipse className={styles.eye} cx="32" cy="49" rx="3.2" ry="4.6" fill={INK} />
          <ellipse className={styles.eye} cx="48" cy="49" rx="3.2" ry="4.6" fill={INK} />
          <path
            d="M34,61 Q40,67 46,61"
            fill="none"
            stroke={INK}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      );
  }
}

export type LumiProps = {
  mood: Mood;
  /** Width in pixels. Height follows the 80:90 drawing. */
  size?: number;
  /** Overrides the accessible name, for other languages. */
  title?: string;
  /** Hide from assistive technology when the text beside it already says who is speaking. */
  decorative?: boolean;
  /** Stand still, for static illustrations. */
  still?: boolean;
};

/** Lumi, the guide: a small round warm-yellow creature with a glowing bulb on a stalk. */
export function Lumi({ mood, size = 76, title, decorative = false, still = false }: LumiProps) {
  const bulb = BULB[mood];
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': title ?? NAMES[mood] } as const);
  return (
    <svg
      className={still ? styles.still : styles.lumi}
      viewBox="0 0 80 90"
      width={size}
      height={(size * 90) / 80}
      data-mood={mood}
      {...a11y}
    >
      <circle cx="40" cy="52" r="38" fill="#FFC21A" opacity={bulb.halo} />
      <path
        d="M40,24 C40,15 44,9 49,7"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="50" cy="7" r={bulb.r} fill={bulb.fill} stroke={INK} strokeWidth="2" />
      <path
        d="M40,24 C60,24 70,39 68,57 C66,75 54,82 40,82 C26,82 14,75 12,57 C10,39 20,24 40,24 Z"
        fill="#FFC21A"
        stroke={INK}
        strokeWidth="2.4"
      />
      <ellipse cx="40" cy="64" rx="15" ry="12" fill="#FFE07A" />
      <circle cx="24" cy="58" r="4" fill="#FF5C9E" opacity=".75" />
      <circle cx="56" cy="58" r="4" fill="#FF5C9E" opacity=".75" />
      <Face mood={mood} />
      <ellipse cx="32" cy="84" rx="6" ry="3" fill={INK} />
      <ellipse cx="48" cy="84" rx="6" ry="3" fill={INK} />
    </svg>
  );
}
