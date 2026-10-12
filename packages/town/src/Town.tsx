import type { KeyboardEvent } from 'react';
import type { CatalogObject, CatalogThread } from '@lumen/lessons';
import { Backdrop } from './Backdrop';
import { anchorOf, TOWN_HEIGHT, TOWN_WIDTH } from './layout';
import { OBJECT_ART } from './objects';
import type { ObjectState } from './state';
import styles from './Town.module.css';

export type TownProps = {
  objects: CatalogObject[];
  places: Record<string, string>;
  states: Record<string, ObjectState>;
  /** The thread being shown, if any. Its objects are joined by a path and the rest are dimmed. */
  thread: CatalogThread | null;
  /** Text on the tag under a "next" object. */
  nextLabel: string;
  /** A full spoken description of one object, including its state. */
  describe: (object: CatalogObject, state: ObjectState) => string;
  /** Short label under an object marked as assigned by a teacher. */
  assigned?: { ids: string[]; label: string };
  /** The object that has just been lit, so it can be celebrated once. */
  justLit?: string | null;
  label: string;
  onOpen: (object: CatalogObject) => void;
};

function threadPath(thread: CatalogThread): string {
  const points = thread.objects.map((id) => anchorOf(id));
  if (points.length === 0) return '';
  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    d += ` Q${(a.x + b.x) / 2},${Math.min(a.y, b.y) - 70} ${b.x},${b.y}`;
  }
  return d;
}

function Tag({ x, y, text }: { x: number; y: number; text: string }) {
  const width = text.length * 8.2 + 24;
  return (
    <g aria-hidden="true">
      <rect
        className={styles.tagBox}
        x={x - width / 2}
        y={y - 14}
        width={width}
        height={26}
        rx={13}
      />
      <text className={styles.tagText} x={x} y={y + 4} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

/** The town: one illustrated scene where every lesson lives inside a real object. */
export function Town({
  objects,
  places,
  states,
  thread,
  nextLabel,
  describe,
  assigned,
  justLit,
  label,
  onOpen,
}: TownProps) {
  const onKey = (event: KeyboardEvent<SVGGElement>, object: CatalogObject) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(object);
    }
  };

  return (
    <div className={styles.frame} data-scroll-x>
      <svg
        className={thread ? `${styles.town} ${styles.dimmed}` : styles.town}
        viewBox={`0 0 ${TOWN_WIDTH} ${TOWN_HEIGHT}`}
        role="group"
        aria-label={label}
      >
        <Backdrop places={places} />

        {thread ? (
          <g aria-hidden="true">
            <path className={styles.thread} d={threadPath(thread)} />
            {thread.objects.map((id) => {
              const a = anchorOf(id);
              return <circle key={id} className={styles.threadDot} cx={a.x} cy={a.y} r="7" />;
            })}
          </g>
        ) : null}

        {objects.map((object) => {
          const art = OBJECT_ART[object.id];
          if (!art) return null;
          const state = states[object.id] ?? 'available';
          const anchor = anchorOf(object.id);
          const linked = thread?.objects.includes(object.id) ?? false;
          const tagY = anchor.tag === 'above' ? anchor.y - anchor.r - 22 : anchor.y + anchor.r + 24;
          const [c1, c2, c3] = art.colors;
          const classes = [
            styles.object,
            linked ? styles.linked : '',
            justLit === object.id ? styles.justLit : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <g
              key={object.id}
              className={classes}
              data-object={object.id}
              data-state={state}
              role="button"
              tabIndex={0}
              aria-label={describe(object, state)}
              onClick={() => onOpen(object)}
              onKeyDown={(event) => onKey(event, object)}
              style={{
                ['--c' as string]: c1,
                ['--c2' as string]: c2 ?? c1,
                ['--c3' as string]: c3 ?? c2 ?? c1,
              }}
            >
              <circle className={styles.hit} cx={anchor.x} cy={anchor.y} r={anchor.r} />
              <circle className={styles.ring} cx={anchor.x} cy={anchor.y} r={anchor.r + 6} />
              <g className={styles.art}>{art.draw()}</g>
              <g className={styles.badge} aria-hidden="true">
                <circle
                  cx={anchor.x + anchor.r * 0.7}
                  cy={anchor.y - anchor.r * 0.74}
                  r="11"
                  style={{ fill: `var(--lm-${object.subject})` }}
                />
                <path
                  d={`M${anchor.x + anchor.r * 0.7 - 5},${anchor.y - anchor.r * 0.74} l4,4 l7,-8`}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              {state === 'next' ? <Tag x={anchor.x} y={tagY} text={nextLabel} /> : null}
              {assigned?.ids.includes(object.id) && state !== 'done' && state !== 'next' ? (
                <Tag x={anchor.x} y={tagY} text={assigned.label} />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
