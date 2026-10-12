import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EventBus,
  resolveText,
  type ChallengeStep,
  type KeepStep,
  type Lesson,
  type LessonRuntime,
  type NameItStep,
  type PredictStep,
  type RuntimeState,
} from '@lumen/engine';
import { Button, SubjectDot } from '@lumen/design';
import { t } from '../i18n';
import { Art, ItemIcon } from './art';
import { InteractiveStage } from './InteractiveStage';
import { SimCanvas } from './SimCanvas';
import styles from './lesson.module.css';

type StepProps<S> = { step: S; runtime: LessonRuntime; state: RuntimeState; lesson: Lesson };

export function PredictView({ step, runtime, state }: StepProps<PredictStep>) {
  const depth = state.depth;
  const demoBus = useMemo(() => new EventBus(), []);
  return (
    <>
      <div className={styles.picks} role="group" aria-label={t('lesson.choices')}>
        {step.choices.map((choice) => {
          const missed = state.wrongChoices.includes(choice.id);
          const right = state.solved && choice.id === step.answer;
          const classes = [
            styles.pick,
            missed ? styles.pickMissed : '',
            right ? styles.pickRight : '',
            !state.solved && state.highlight === choice.id ? styles.pickGlow : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={choice.id}
              type="button"
              className={classes}
              data-choice={choice.id}
              disabled={missed || (state.solved && !right)}
              aria-disabled={state.solved || undefined}
              aria-pressed={right}
              onClick={() => {
                if (!state.solved) runtime.answerPredict(choice.id);
              }}
            >
              <span className={styles.pickArt}>
                <Art id={choice.art} />
              </span>
              <span>{resolveText(choice.label, depth)}</span>
            </button>
          );
        })}
      </div>
      {state.demo ? (
        <SimCanvas
          spec={state.demo}
          bus={demoBus}
          depth={depth}
          label={t('lesson.demoLabel')}
          className={styles.demo}
        />
      ) : null}
      {!state.solved ? (
        <div className={styles.hintRow}>
          <Button variant="secondary" onClick={() => runtime.requestHint()}>
            {t('lesson.hint')}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** Splits "Ice is less *dense* than water." into plain text and the highlighted term. */
export function emphasise(text: string): { text: string; strong: boolean }[] {
  return text
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('*') && part.endsWith('*') ? { text: part.slice(1, -1), strong: true } : { text: part, strong: false },
    );
}

export function NameItView({ step, state, runtime }: StepProps<NameItStep>) {
  const depth = state.depth;
  return (
    <div className={styles.statement}>
      <p className={styles.statementBody}>{resolveText(step.body, depth)}</p>
      {depth === 'deep' && step.formula ? (
        <div className={styles.formula}>
          {step.formula.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {step.formula.table.length > 0 ? (
            <table>
              <tbody>
                {step.formula.table.map(([name, value]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {step.formula.note ? <span className={styles.formulaNote}>{step.formula.note}</span> : null}
        </div>
      ) : null}
      {step.sim ? (
        <SimCanvas spec={step.sim} bus={runtime.bus} depth={depth} label={step.term} className={styles.demo} />
      ) : null}
    </div>
  );
}

export function ChallengeView({ step, runtime, state, lesson }: StepProps<ChallengeStep>) {
  const depth = state.depth;
  const [missed, setMissed] = useState<Record<string, string>>({});
  const thenRef = useRef<HTMLDivElement>(null);
  const showThen = step.then !== undefined && state.stage === 'then';

  useEffect(() => {
    if (showThen && step.sort) {
      thenRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [showThen, step.sort]);

  return (
    <>
      {step.sort ? (
        <ul className={styles.sorts} aria-label={t('lesson.sortGroup')}>
          {step.sort.items.map((item) => {
            const done = state.sorted.includes(item.id);
            const name = resolveText(item.name, depth);
            return (
              <li
                key={item.id}
                className={[styles.sort, done ? styles.sortDone : '', missed[item.id] && !done ? styles.sortMissed : '']
                  .filter(Boolean)
                  .join(' ')}
                data-item={item.id}
              >
                <ItemIcon id={item.icon} />
                <span className={styles.sortName}>
                  {name}
                  {depth !== 'play' && item.detail ? <small>{item.detail}</small> : null}
                </span>
                <span className={styles.sortButtons}>
                  {step.sort!.bins.map((bin) => {
                    const label = resolveText(bin.label, depth);
                    const chosen = done && item.bin === bin.id;
                    return (
                      <button
                        key={bin.id}
                        type="button"
                        className={chosen ? `${styles.bin} ${styles.binChosen}` : styles.bin}
                        aria-label={t('lesson.sorted', { name, bin: label })}
                        aria-pressed={chosen}
                        disabled={(done && !chosen) || (!done && missed[item.id] === bin.id)}
                        aria-disabled={done || undefined}
                        onClick={() => {
                          if (done) return;
                          const result = runtime.answerSort(item.id, bin.id);
                          if (result === 'not_quite') setMissed((current) => ({ ...current, [item.id]: bin.id }));
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {showThen && step.then ? (
        <div ref={thenRef} className={styles.then}>
          {step.then.title && step.sort ? <h2 className={styles.thenTitle}>{resolveText(step.then.title, depth)}</h2> : null}
          <InteractiveStage
            stage={step.then}
            runtime={runtime}
            state={state}
            label={resolveText(step.then.title ?? lesson.title, depth)}
          />
        </div>
      ) : null}
    </>
  );
}

export function KeepView({ step, state, lesson }: StepProps<KeepStep>) {
  const depth = state.depth;
  return (
    <div className={styles.keep}>
      <div className={styles.bigCard}>
        <span className={styles.cardLabel}>
          <SubjectDot subject={lesson.subject} />
          {t('lesson.newCard', { subject: t(`subject.${lesson.subject}`) })}
        </span>
        <p className={styles.cardText}>{lesson.card}</p>
        <p className={styles.cardSummary}>{resolveText(lesson.summary, depth)}</p>
      </div>
      <div className={styles.where}>
        <h2>{t('lesson.whereElse')}</h2>
        <ul>
          {step.where_else.map((entry) => (
            <li key={entry.title}>
              <b>{entry.title}</b>
              <span>{resolveText(entry.text, depth)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
