import styles from './ProgressDots.module.css';

/** Step progress: done is ink, current is Lumi yellow, upcoming is a hairline grey. */
export function ProgressDots({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div role="img" aria-label={label} className={styles.dots}>
      {Array.from({ length: total }, (_, index) => (
        <i
          key={index}
          data-state={index < current ? 'done' : index === current ? 'current' : 'upcoming'}
        />
      ))}
    </div>
  );
}
