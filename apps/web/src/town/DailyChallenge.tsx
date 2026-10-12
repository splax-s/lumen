import { useEffect, useState } from 'react';
import { resolveText, type Depth, type Lesson, type PredictStep } from '@lumen/engine';
import { catalog, loadLesson } from '@lumen/lessons';
import { t } from '../i18n';
import { dayNumber, pickDailyLesson } from './daily';
import styles from './town.module.css';

const KEY = 'lumen.daily';

function readSolved(): number | null {
  try {
    const value = Number(localStorage.getItem(KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** One quick question a day, taken from the predict step of a finished lesson. */
export function DailyChallenge({ done, depth }: { done: string[]; depth: Depth }) {
  const [today] = useState(() => dayNumber(Date.now()));
  const built = catalog.objects.filter((o) => o.built && o.lesson).map((o) => o.lesson!);
  const lessonId = pickDailyLesson(done, built, today);
  const [loaded, setLoaded] = useState<Lesson | null>(null);
  const [missed, setMissed] = useState<string[]>([]);
  const [solved, setSolved] = useState(() => readSolved() === today);

  useEffect(() => {
    let cancelled = false;
    if (!lessonId) return;
    loadLesson(lessonId)
      .then((lesson) => {
        if (!cancelled) setLoaded(lesson);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (!lessonId) return null;
  const lesson = loaded?.id === lessonId ? loaded : null;
  const predict = lesson?.steps.find((s): s is PredictStep => s.type === 'predict');

  const answer = (choice: string) => {
    if (!predict) return;
    if (choice === predict.answer) {
      setSolved(true);
      try {
        localStorage.setItem(KEY, String(today));
      } catch {
        // Not saved; the challenge simply shows again on reload.
      }
    } else {
      setMissed((current) => [...current, choice]);
    }
  };

  return (
    <section className={styles.daily} aria-labelledby="daily-title">
      <span className={styles.dailyEyebrow}>{t('town.daily.eyebrow')}</span>
      {predict && lesson ? (
        <>
          <h2 id="daily-title" className={styles.dailyTitle}>
            {resolveText(predict.title, depth)}
          </h2>
          <span className={styles.dailyMeta}>
            {t('town.daily.meta', { subject: t(`subject.${lesson.subject}`) })}
          </span>
          <div className={styles.dailyChoices}>
            {predict.choices.map((choice) => {
              const right = solved && choice.id === predict.answer;
              return (
                <button
                  key={choice.id}
                  type="button"
                  className={
                    right ? `${styles.dailyChoice} ${styles.dailyRight}` : styles.dailyChoice
                  }
                  disabled={missed.includes(choice.id) || (solved && !right)}
                  aria-pressed={right}
                  onClick={() => {
                    if (!solved) answer(choice.id);
                  }}
                >
                  {resolveText(choice.label, depth)}
                </button>
              );
            })}
          </div>
          <p className={styles.dailyStatus} aria-live="polite">
            {solved ? t('town.daily.done') : missed.length > 0 ? t('town.daily.notQuite') : ''}
          </p>
        </>
      ) : (
        <h2 id="daily-title" className={styles.dailyTitle}>
          {t('town.daily.loading')}
        </h2>
      )}
    </section>
  );
}
