import type { ButtonHTMLAttributes } from 'react';
import styles from './Chip.module.css';

/** A toggle chip, used for threads. */
export function Chip({
  pressed,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={[styles.chip, pressed ? styles.pressed : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}
