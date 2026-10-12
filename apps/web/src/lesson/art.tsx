import type { ReactNode } from 'react';

/**
 * Small pictures used inside lessons: the three choices of a predict step, and icons for
 * things that are dropped or sorted. Lesson files refer to them by id.
 */

const INK = 'var(--lm-ink)';
const stroke = {
  stroke: INK,
  strokeWidth: 2,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

function bottle(width: number, cracked: boolean): ReactNode {
  const cx = 60;
  const w = width;
  return (
    <svg viewBox="0 0 120 140" aria-hidden="true">
      <rect x={cx - 7} y="8" width="14" height="14" rx="2" fill={INK} />
      <path
        d={`M${cx - 6},22 C${cx - 6},32 ${cx - w / 2},34 ${cx - w / 2},48 L${cx - w / 2},126 Q${cx - w / 2},132 ${cx - w / 2 + 6},132 L${cx + w / 2 - 6},132 Q${cx + w / 2},132 ${cx + w / 2},126 L${cx + w / 2},48 C${cx + w / 2},34 ${cx + 6},32 ${cx + 6},22 Z`}
        fill="#E3F5FF"
        {...stroke}
      />
      {cracked ? (
        <path d={`M${cx + w / 2 - 4},70 l-8,8 l6,4 l-8,10`} fill="none" {...stroke} />
      ) : null}
      <path d={`M${cx - w / 2 + 6},60 l6,-4`} fill="none" {...stroke} />
    </svg>
  );
}

const ART: Record<string, () => ReactNode> = {
  'bottle:small': () => bottle(28, false),
  'bottle:same': () => bottle(36, false),
  'bottle:big': () => bottle(48, true),
};

const ICONS: Record<string, () => ReactNode> = {
  coin: () => (
    <>
      <circle cx="20" cy="20" r="14" fill="#D4A72C" {...stroke} />
      <circle cx="20" cy="20" r="8" fill="none" stroke={INK} strokeWidth="1.3" />
    </>
  ),
  cork: () => (
    <>
      <path d="M12,6 H28 L26,34 H14 Z" fill="#C99A66" {...stroke} />
      <circle cx="18" cy="14" r="1.2" fill={INK} />
      <circle cx="23" cy="22" r="1.2" fill={INK} />
      <circle cx="18" cy="27" r="1.2" fill={INK} />
    </>
  ),
  ice: () => (
    <>
      <rect x="8" y="8" width="24" height="24" rx="5" fill="#E3F5FF" {...stroke} />
      <path d="M13,14 l5,-3" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  apple: () => (
    <>
      <path
        d="M20,12 C12,6 4,12 6,22 C8,32 16,36 20,33 C24,36 32,32 34,22 C36,12 28,6 20,12 Z"
        fill="#E2453C"
        {...stroke}
      />
      <path d="M20,12 V5" fill="none" {...stroke} />
      <path
        d="M21,8 C25,3 30,5 30,6 C27,9 24,9 21,8 Z"
        fill="#5AA62D"
        stroke={INK}
        strokeWidth="1.5"
      />
    </>
  ),
  log: () => (
    <>
      <rect x="4" y="13" width="32" height="14" rx="7" fill="#B07A45" {...stroke} />
      <ellipse cx="31" cy="20" rx="4" ry="6" fill="#D9AD7C" stroke={INK} strokeWidth="1.6" />
    </>
  ),
  stone: () => <path d="M6,30 Q6,12 18,11 Q34,10 34,30 Z" fill="#8E9196" {...stroke} />,
  iceberg: () => (
    <>
      <path
        d="M8,24 L12,36 L28,36 L32,24"
        fill="#BFE3F7"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8,24 L16,8 L22,14 L30,24 Z" fill="#E3F5FF" {...stroke} />
      <path d="M4,24 H36" fill="none" {...stroke} />
    </>
  ),
  bolt: () => (
    <>
      <rect x="12" y="6" width="16" height="8" rx="1" fill="#9AA3AD" {...stroke} />
      <rect x="17" y="14" width="6" height="20" fill="#9AA3AD" {...stroke} />
    </>
  ),
  oil: () => (
    <path
      d="M20,6 C26,16 30,20 30,26 C30,32 25,35 20,35 C15,35 10,32 10,26 C10,20 14,16 20,6 Z"
      fill="#F2C94C"
      {...stroke}
    />
  ),
  honey: () => (
    <>
      <path d="M22,22 L36,12" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="14" cy="24" rx="9" ry="7" fill="#E8A317" {...stroke} />
    </>
  ),
};

/** A picture for a predict choice. Unknown ids draw nothing, so a typo cannot break a lesson. */
export function Art({ id }: { id: string }) {
  return <>{ART[id]?.() ?? null}</>;
}

export function ItemIcon({ id, size = 40 }: { id: string | undefined; size?: number }) {
  const draw = id ? ICONS[id] : undefined;
  if (!draw) return null;
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ flex: '0 0 auto' }}
    >
      {draw()}
    </svg>
  );
}

export const ART_IDS = Object.keys(ART);
export const ICON_IDS = Object.keys(ICONS);
