import type { ReactNode } from 'react';
import type { Mood } from '@lumen/engine';
import { Lumi } from './Lumi';
import styles from './LumiStrip.module.css';

export type LumiStripProps = {
  mood: Mood;
  text: string;
  /** Lumi's name as shown in the bubble. */
  name: string;
  speakLabel: string;
  /** Leave out when read-aloud is not available; the button is then not shown. */
  onSpeak?: (() => void) | undefined;
  /** Navigation or actions, placed to the right. */
  children?: ReactNode;
  size?: 'md' | 'sm';
};

/** Lumi on the left, a speech bubble with read-aloud, and actions on the right. */
export function LumiStrip({
  mood,
  text,
  name,
  speakLabel,
  onSpeak,
  children,
  size = 'md',
}: LumiStripProps) {
  return (
    <div className={size === 'sm' ? `${styles.strip} ${styles.small}` : styles.strip}>
      <div className={styles.speaker}>
        <Lumi mood={mood} size={size === 'sm' ? 56 : 76} decorative />
        <div className={styles.bubble}>
          <p aria-live="polite" aria-atomic="true" className={styles.text}>
            <b className={styles.name}>{name}</b> <span data-testid="lumi-text">{text}</span>
          </p>
          {onSpeak ? (
            <button
              type="button"
              className={styles.speak}
              aria-label={speakLabel}
              onClick={onSpeak}
            >
              <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
                <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
                <path
                  d="M11 5c1.2 1.6 1.2 4.4 0 6M13 3c2.3 2.8 2.3 7.2 0 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </div>
  );
}
