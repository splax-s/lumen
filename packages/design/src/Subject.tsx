import type { Subject } from '@lumen/engine';
import styles from './Subject.module.css';

/** A small dot in the subject's colour. Subjects are never shown as large filled areas. */
export function SubjectDot({ subject, size = 8 }: { subject: Subject; size?: number }) {
  return (
    <i
      aria-hidden="true"
      className={styles.dot}
      style={{ width: size, height: size, background: `var(--lm-${subject})` }}
    />
  );
}

/** A tinted pill naming the subject. */
export function SubjectChip({ subject, label }: { subject: Subject; label: string }) {
  return (
    <span
      className={styles.chip}
      style={{ background: `var(--lm-${subject}-tint)`, color: `var(--lm-${subject}-text)` }}
    >
      {label}
    </span>
  );
}
