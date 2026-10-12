import { useRef, type KeyboardEvent } from 'react';
import { DEPTHS, type Depth } from '@lumen/engine';
import styles from './DepthSwitch.module.css';

export type DepthSwitchProps = {
  value: Depth;
  onChange: (depth: Depth) => void;
  labels: { group: string } & Record<Depth, string>;
  compact?: boolean;
};

/** Segmented pill for Play, Explain and Deep. Behaves as a radio group. */
export function DepthSwitch({ value, onChange, labels, compact = false }: DepthSwitchProps) {
  const refs = useRef<Partial<Record<Depth, HTMLButtonElement | null>>>({});

  const move = (event: KeyboardEvent<HTMLButtonElement>, depth: Depth) => {
    const index = DEPTHS.indexOf(depth);
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % DEPTHS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + DEPTHS.length - 1) % DEPTHS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = DEPTHS.length - 1;
    else return;
    event.preventDefault();
    const target = DEPTHS[next]!;
    onChange(target);
    refs.current[target]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={labels.group} className={compact ? `${styles.track} ${styles.compact}` : styles.track}>
      {DEPTHS.map((depth) => (
        <button
          key={depth}
          ref={(node) => {
            refs.current[depth] = node;
          }}
          type="button"
          role="radio"
          aria-checked={depth === value}
          tabIndex={depth === value ? 0 : -1}
          className={depth === value ? `${styles.option} ${styles.selected}` : styles.option}
          onClick={() => onChange(depth)}
          onKeyDown={(event) => move(event, depth)}
        >
          {labels[depth]}
        </button>
      ))}
    </div>
  );
}
