import type { KeyboardEvent } from 'react';
import { SUBJECTS } from '@lumen/engine';
import type { CatalogObject, CatalogThread } from '@lumen/lessons';
import type { ObjectState } from './state';
import styles from './ConceptWeb.module.css';

export type ConceptWebProps = {
  objects: CatalogObject[];
  subjects: Record<string, string>;
  states: Record<string, ObjectState>;
  thread: CatalogThread | null;
  describe: (object: CatalogObject, state: ObjectState) => string;
  label: string;
  onOpen: (object: CatalogObject) => void;
};

const WIDTH = 1100;
const COLUMN = WIDTH / SUBJECTS.length;
const NODE_W = 200;
const NODE_H = 56;
const TOP = 86;
const ROW = 112;

/**
 * The same lessons as the town, drawn as a network for older learners: one column per subject,
 * solid lines for "do this first", and a dashed line through the lessons of the chosen thread.
 */
export function ConceptWeb({
  objects,
  subjects,
  states,
  thread,
  describe,
  label,
  onOpen,
}: ConceptWebProps) {
  const lessons = objects.filter((o) => o.lesson !== null);
  const position = new Map<string, { x: number; y: number }>();
  SUBJECTS.forEach((subject, column) => {
    lessons
      .filter((o) => o.subject === subject)
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
      .forEach((object, row) => {
        position.set(object.id, {
          x: column * COLUMN + COLUMN / 2,
          y: TOP + row * ROW + NODE_H / 2,
        });
      });
  });
  const rows = Math.max(...SUBJECTS.map((s) => lessons.filter((o) => o.subject === s).length));
  const height = TOP + rows * ROW;
  const byLesson = new Map(lessons.map((o) => [o.lesson!, o]));

  const onKey = (event: KeyboardEvent<SVGGElement>, object: CatalogObject) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(object);
    }
  };

  const threadPoints = thread
    ? thread.objects
        .map((id) => position.get(id))
        .filter((p): p is { x: number; y: number } => p !== undefined)
    : [];

  return (
    <div className={styles.frame} data-scroll-x>
      <svg
        className={styles.web}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="group"
        aria-label={label}
      >
        {SUBJECTS.map((subject, column) => (
          <g key={subject} aria-hidden="true">
            <circle
              cx={column * COLUMN + COLUMN / 2 - 44}
              cy="40"
              r="5"
              style={{ fill: `var(--lm-${subject})` }}
            />
            <text className={styles.heading} x={column * COLUMN + COLUMN / 2 - 32} y="45">
              {subjects[subject]}
            </text>
          </g>
        ))}

        <g aria-hidden="true">
          {lessons.flatMap((object) =>
            object.needs.map((need) => {
              const from = position.get(byLesson.get(need)?.id ?? '');
              const to = position.get(object.id);
              if (!from || !to) return null;
              return (
                <path
                  key={`${need}-${object.id}`}
                  className={styles.needs}
                  d={`M${from.x},${from.y + NODE_H / 2} L${to.x},${to.y - NODE_H / 2}`}
                />
              );
            }),
          )}
          {threadPoints.length > 1 ? (
            <path
              className={styles.thread}
              d={threadPoints
                .map((p, i) => {
                  if (i === 0) return `M${p.x},${p.y}`;
                  const prev = threadPoints[i - 1]!;
                  return `Q${(prev.x + p.x) / 2},${Math.min(prev.y, p.y) - 46} ${p.x},${p.y}`;
                })
                .join(' ')}
            />
          ) : null}
        </g>

        {lessons.map((object) => {
          const p = position.get(object.id)!;
          const state = states[object.id] ?? 'available';
          const linked = thread?.objects.includes(object.id) ?? false;
          return (
            <g
              key={object.id}
              className={[styles.node, thread && !linked ? styles.faded : '']
                .filter(Boolean)
                .join(' ')}
              data-object={object.id}
              data-state={state}
              role="button"
              tabIndex={0}
              aria-label={describe(object, state)}
              onClick={() => onOpen(object)}
              onKeyDown={(event) => onKey(event, object)}
            >
              <rect
                x={p.x - NODE_W / 2}
                y={p.y - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx="16"
              />
              <circle
                cx={p.x - NODE_W / 2 + 18}
                cy={p.y}
                r="5"
                style={{ fill: `var(--lm-${object.subject})` }}
              />
              <text x={p.x - NODE_W / 2 + 32} y={p.y + 5}>
                {object.name.length > 21 ? `${object.name.slice(0, 20)}…` : object.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
