import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DEPTHS,
  LessonRuntime,
  resolveText,
  type Depth,
  type Lesson,
  type RuntimeState,
} from '@lumen/engine';
import { Button, DepthSwitch, LumiStrip, ProgressDots, SubjectChip } from '@lumen/design';
import { loadLesson, lessonExists, objectForLesson } from '@lumen/lessons';
import { t } from '../i18n';
import { narration } from '../services/narration';
import { progress } from '../state/progress';
import { useProgress } from '../state/useProgress';
import { InteractiveStage } from './InteractiveStage';
import { ChallengeView, KeepView, NameItView, PredictView, emphasise } from './steps';
import styles from './lesson.module.css';

type Loaded = { key: string; status: 'ready'; lesson: Lesson } | { key: string; status: 'error' };

export default function LessonPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${id}#${attempt}`;
  const exists = lessonExists(id);

  useEffect(() => {
    if (!exists) return;
    let cancelled = false;
    loadLesson(id)
      .then((lesson) => {
        if (!cancelled) setResult({ key, status: 'ready', lesson });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, key, exists]);

  // A result for an earlier lesson or an earlier try is ignored, so the screen shows "loading" again.
  const current = result !== null && result.key === key ? result : null;
  const loaded: { status: 'loading' | 'missing' | 'error' } | { status: 'ready'; lesson: Lesson } =
    !exists ? { status: 'missing' } : (current ?? { status: 'loading' });

  if (loaded.status === 'ready')
    return <LessonPlayer key={loaded.lesson.id} lesson={loaded.lesson} />;

  return (
    <main className={styles.message}>
      {loaded.status === 'loading' ? (
        <p role="status">{t('app.loading')}</p>
      ) : (
        <>
          <h1>{t(loaded.status === 'missing' ? 'lesson.notFoundTitle' : 'lesson.errorTitle')}</h1>
          <p>{t(loaded.status === 'missing' ? 'lesson.notFoundBody' : 'lesson.errorBody')}</p>
          <div className={styles.messageActions}>
            {loaded.status === 'error' ? (
              <Button onClick={() => setAttempt((n) => n + 1)}>{t('lesson.retry')}</Button>
            ) : null}
            <Button variant="secondary" onClick={() => navigate('/town')}>
              {t('lesson.backToTown')}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

function useRuntimeState(runtime: LessonRuntime): RuntimeState {
  const subscribe = useCallback((listener: () => void) => runtime.subscribe(listener), [runtime]);
  const snapshot = useCallback(() => runtime.getState(), [runtime]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate();
  const stored = useProgress();
  const runtime = useMemo(
    () => new LessonRuntime(lesson, { depth: progress.get().depth }),
    [lesson],
  );
  const state = useRuntimeState(runtime);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const firstStep = useRef(true);
  const depth = state.depth;
  const step = state.step;
  const object = objectForLesson(lesson.id);
  const lumiText = resolveText(state.lumi.text, depth);
  const canSpeak = narration.available();

  useEffect(() => {
    runtime.setDepth(stored.depth);
  }, [runtime, stored.depth]);

  useEffect(() => {
    document.title = `${resolveText(lesson.title, 'explain')} · ${t('app.name')}`;
  }, [lesson]);

  // New step: start at the top and move focus to its heading, so keyboard and screen-reader users follow.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    stageRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [state.stepIndex]);

  // At Play depth Lumi's lines are read aloud as they appear.
  useEffect(() => {
    if (depth === 'play' && stored.narrate && canSpeak) narration.speak(lumiText);
  }, [lumiText, depth, stored.narrate, canSpeak]);

  useEffect(() => () => narration.stop(), []);

  useEffect(() => {
    if (!state.finished) return;
    progress.completeLesson(runtime.attempt());
    navigate(object ? `/town?lit=${object.id}` : '/town', { replace: true });
  }, [state.finished, runtime, navigate, object]);

  const title = step.type === 'keep' ? t('lesson.keepTitle') : resolveText(step.title, depth);
  const last = state.stepIndex === state.stepCount - 1;
  const continueLabel = state.ready
    ? t(last ? 'lesson.finish' : 'lesson.continue')
    : t(`lesson.waiting.${step.type}`);
  const depthLabels = {
    group: t('depth.group'),
    play: t('depth.play'),
    explain: t('depth.explain'),
    deep: t('depth.deep'),
  };

  return (
    <div
      className={styles.lesson}
      style={{ ['--lm-accent' as string]: `var(--lm-${lesson.subject})` }}
    >
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/town')}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M11,3 L5,9 L11,15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{t('lesson.backToTown')}</span>
        </button>
        <div className={styles.progress}>
          <span className={styles.subject}>
            <SubjectChip subject={lesson.subject} label={t(`subject.${lesson.subject}`)} />
          </span>
          <ProgressDots
            current={state.stepIndex}
            total={state.stepCount}
            label={t('lesson.step', { current: state.stepIndex + 1, total: state.stepCount })}
          />
        </div>
        <div className={styles.depthWide}>
          <DepthSwitch value={depth} onChange={(d) => progress.setDepth(d)} labels={depthLabels} />
        </div>
        <label className={styles.depthNarrow}>
          <span className="lm-visually-hidden">{t('depth.group')}</span>
          <select
            value={depth}
            onChange={(event) => progress.setDepth(event.target.value as Depth)}
          >
            {DEPTHS.map((d) => (
              <option key={d} value={d}>
                {depthLabels[d]}
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* The stage scrolls on small screens, so it takes keyboard focus for arrow-key scrolling. */}
      <main
        ref={stageRef}
        className={styles.stage}
        data-step={step.type}
        tabIndex={0}
        aria-label={title}
      >
        <div className={styles.inner} key={state.stepIndex}>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className={step.type === 'name_it' ? styles.statementTitle : styles.title}
          >
            {step.type === 'name_it'
              ? emphasise(title).map((part, index) =>
                  part.strong ? (
                    <em key={index}>{part.text}</em>
                  ) : (
                    <span key={index}>{part.text}</span>
                  ),
                )
              : title}
          </h1>
          {step.type === 'hook' || step.type === 'poke' || step.type === 'zoom' ? (
            <InteractiveStage stage={step} runtime={runtime} state={state} label={title} />
          ) : null}
          {step.type === 'predict' ? (
            <PredictView step={step} runtime={runtime} state={state} lesson={lesson} />
          ) : null}
          {step.type === 'name_it' ? (
            <NameItView step={step} runtime={runtime} state={state} lesson={lesson} />
          ) : null}
          {step.type === 'challenge' ? (
            <ChallengeView step={step} runtime={runtime} state={state} lesson={lesson} />
          ) : null}
          {step.type === 'keep' ? (
            <KeepView step={step} runtime={runtime} state={state} lesson={lesson} />
          ) : null}
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <LumiStrip
            mood={state.lumi.mood}
            text={lumiText}
            name={t('lumi.name')}
            speakLabel={t('lumi.speak')}
            onSpeak={canSpeak ? () => narration.speak(lumiText) : undefined}
          >
            {state.stepIndex > 0 ? (
              <Button
                variant="secondary"
                size="lg"
                className={styles.navBack}
                onClick={() => runtime.back()}
              >
                {t('lesson.back')}
              </Button>
            ) : null}
            <Button
              size="lg"
              className={styles.navNext}
              disabled={!state.ready}
              onClick={() => runtime.next()}
            >
              {continueLabel}
            </Button>
          </LumiStrip>
        </div>
      </footer>
    </div>
  );
}
