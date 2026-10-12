import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SUBJECTS, type Depth } from '@lumen/engine';
import { BottomSheet, Button, Chip, DepthSwitch, Lumi, LumiStrip, SubjectDot } from '@lumen/design';
import { catalog, type CatalogObject } from '@lumen/lessons';
import {
  ConceptWeb,
  Town,
  lockedBy,
  nextTag,
  objectStates,
  subjectProgress,
  type ObjectState,
} from '@lumen/town';
import { t } from '../i18n';
import { narration } from '../services/narration';
import { progress } from '../state/progress';
import { useProgress } from '../state/useProgress';
import { DailyChallenge } from './DailyChallenge';
import styles from './town.module.css';

const VIEW_KEY = 'lumen.townView';

function storedView(): 'town' | 'web' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'web' ? 'web' : 'town';
  } catch {
    return 'town';
  }
}

function lumiLine(
  done: string[],
  states: Record<string, ObjectState>,
  depth: Depth,
  threadName: string | null,
) {
  if (threadName)
    return {
      mood: 'happy' as const,
      text: t(`town.lumi.thread.${depth}`, { name: threadName }),
      next: null,
    };
  const lessons = catalog.objects.filter((o) => o.lesson !== null);
  if (done.length === 0) {
    return {
      mood: 'happy' as const,
      text: t(`town.lumi.welcome.${depth}`),
      next: lessons.find((o) => states[o.id] === 'next') ?? null,
    };
  }
  if (lessons.every((o) => states[o.id] === 'done')) {
    return { mood: 'proud' as const, text: t(`town.lumi.allDone.${depth}`), next: null };
  }
  const last = catalog.objects.find((o) => o.lesson === done[done.length - 1]);
  const next = lessons.find((o) => states[o.id] === 'next' && o.built) ?? null;
  const lastName = (last?.name ?? '').toLowerCase();
  if (!next)
    return {
      mood: 'proud' as const,
      text: t(`town.lumi.soon.${depth}`, { last: lastName }),
      next: null,
    };
  return {
    mood: 'proud' as const,
    text: t(`town.lumi.next.${depth}`, {
      last: lastName,
      next: next.name.toLowerCase(),
      question: next.question,
    }),
    next,
  };
}

export default function TownPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stored = useProgress();
  const depth = stored.depth;
  const done = useMemo(() => stored.done.map((d) => d.lessonId), [stored.done]);
  const states = useMemo(() => objectStates(catalog.objects, done), [done]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [open, setOpen] = useState<CatalogObject | null>(null);
  // Coming back from a lesson, the address names the object that was just lit.
  const [justLit] = useState(() => params.get('lit'));
  const [view, setView] = useState<'town' | 'web'>(() =>
    params.get('lit') ? 'town' : storedView(),
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const thread = catalog.threads.find((th) => th.id === threadId) ?? null;
  const counts = subjectProgress(catalog.objects, done);
  const canSpeak = narration.available();
  const lumi = lumiLine(done, states, depth, thread?.name ?? null);

  useEffect(() => {
    document.title = `${t('town.title')} · ${t('app.name')}`;
  }, []);

  // Bring the newly lit object into view, then tidy the address.
  useEffect(() => {
    if (!justLit) return;
    const node = sceneRef.current?.querySelector(`[data-object="${CSS.escape(justLit)}"]`);
    node?.scrollIntoView({ block: 'nearest', inline: 'center' });
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('lit');
        return next;
      },
      { replace: true },
    );
  }, [justLit, setParams]);

  useEffect(() => () => narration.stop(), []);

  const chooseView = (next: 'town' | 'web') => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // The choice lasts for this visit only.
    }
  };

  const describe = (object: CatalogObject, state: ObjectState) =>
    t('town.describe', {
      name: object.name,
      question: object.question,
      state: t(`town.state.${state}`),
    });

  const depthLabels = {
    group: t('depth.group'),
    play: t('depth.play'),
    explain: t('depth.explain'),
    deep: t('depth.deep'),
  };
  const openState = open ? (states[open.id] ?? 'available') : 'available';
  const blocker = open ? lockedBy(open, done, catalog.objects) : null;
  const canStart = open !== null && open.built && openState !== 'locked' && openState !== 'soon';
  const cards = [...stored.cards].reverse();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Lumi mood="happy" size={34} decorative still />
          <h1>{t('town.title')}</h1>
        </div>
        <ul
          className={styles.subjects}
          aria-label={t('town.progressLabel', { subject: '', done: done.length, total: 20 }).trim()}
        >
          {SUBJECTS.map((subject) => (
            <li
              key={subject}
              aria-label={t('town.progressLabel', {
                subject: t(`subject.${subject}`),
                done: counts[subject].done,
                total: counts[subject].total,
              })}
            >
              <SubjectDot subject={subject} size={10} />
              <span aria-hidden="true">
                {t('town.progress', {
                  subject: t(`subject.${subject}`),
                  done: counts[subject].done,
                  total: counts[subject].total,
                })}
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.headerEnd}>
          <span className={styles.streak}>
            {stored.streak.current > 0
              ? t('town.streak', { count: stored.streak.current })
              : t('town.streakNone')}
          </span>
          <DepthSwitch value={depth} onChange={(d) => progress.setDepth(d)} labels={depthLabels} />
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.main}>
          <div className={styles.viewRow} role="group" aria-label={t('town.viewGroup')}>
            <Chip pressed={view === 'town'} onClick={() => chooseView('town')}>
              {t('town.viewTown')}
            </Chip>
            <Chip pressed={view === 'web'} onClick={() => chooseView('web')}>
              {t('town.viewWeb')}
            </Chip>
          </div>

          <div ref={sceneRef}>
            {view === 'town' ? (
              <Town
                objects={catalog.objects}
                places={catalog.places}
                states={states}
                thread={thread}
                nextLabel={t(nextTag(done) === 'start' ? 'town.startHere' : 'town.nextUp')}
                describe={describe}
                justLit={justLit}
                label={t('town.label')}
                onOpen={setOpen}
              />
            ) : (
              <ConceptWeb
                objects={catalog.objects}
                subjects={catalog.subjects}
                states={states}
                thread={thread}
                describe={describe}
                label={t('town.webLabel')}
                onOpen={setOpen}
              />
            )}
          </div>

          <LumiStrip
            mood={lumi.mood}
            text={lumi.text}
            name={t('lumi.name')}
            speakLabel={t('lumi.speak')}
            onSpeak={canSpeak ? () => narration.speak(lumi.text) : undefined}
          >
            {lumi.next ? (
              <Button
                size="lg"
                onClick={() =>
                  lumi.next!.built ? navigate(`/lesson/${lumi.next!.lesson}`) : setOpen(lumi.next)
                }
              >
                {t('town.play', { name: lumi.next.name })}
              </Button>
            ) : null}
          </LumiStrip>
        </main>

        <aside className={styles.side}>
          <DailyChallenge done={done} depth={depth} />

          <section className={styles.panel} aria-labelledby="threads-title">
            <h2 id="threads-title">{t('town.threads.title')}</h2>
            <p className={styles.panelHint}>{t('town.threads.hint')}</p>
            <div className={styles.chips}>
              {catalog.threads.map((th) => (
                <Chip
                  key={th.id}
                  pressed={threadId === th.id}
                  onClick={() => setThreadId(threadId === th.id ? null : th.id)}
                >
                  {th.name}
                  <small>{t('town.threads.places', { count: th.objects.length })}</small>
                </Chip>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="cards-title">
            <h2 id="cards-title">
              {cards.length > 0
                ? t('town.cards.title', { count: cards.length })
                : t('town.cards.titleEmpty')}
            </h2>
            {cards.length === 0 ? (
              <p className={styles.panelHint}>{t('town.cards.empty')}</p>
            ) : (
              <ul className={styles.cards}>
                {cards.map((card) => {
                  const object = catalog.objects.find((o) => o.lesson === card.lessonId);
                  if (!object) return null;
                  return (
                    <li key={card.lessonId}>
                      <span className={styles.cardSubject}>
                        <SubjectDot subject={object.subject} />
                        {t(`subject.${object.subject}`)}
                      </span>
                      <b>{object.card ?? object.question}</b>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="settings-title">
            <h2 id="settings-title">{t('town.settings.title')}</h2>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={stored.narrate}
                onChange={(event) => progress.setNarrate(event.target.checked)}
              />
              <span>{t('town.settings.narrate')}</span>
            </label>
            {confirmReset ? (
              <div
                className={styles.confirm}
                role="group"
                aria-label={t('town.settings.resetConfirm')}
              >
                <p>{t('town.settings.resetConfirm')}</p>
                <div className={styles.confirmActions}>
                  <Button
                    variant="danger"
                    onClick={() => {
                      progress.reset();
                      setConfirmReset(false);
                      setThreadId(null);
                    }}
                  >
                    {t('town.settings.resetYes')}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                    {t('town.settings.resetNo')}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  variant="secondary"
                  disabled={done.length === 0}
                  onClick={() => setConfirmReset(true)}
                >
                  {t('town.settings.reset')}
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>

      <BottomSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.question ?? ''}
        closeLabel={t('town.sheet.close')}
        eyebrow={
          open ? (
            <>
              <SubjectDot subject={open.subject} />
              {t('town.sheet.place', {
                subject: t(`subject.${open.subject}`),
                place: catalog.places[open.place] ?? '',
              })}
            </>
          ) : null
        }
      >
        {open ? (
          <>
            <p className={styles.sheetBody}>{open.blurb}</p>
            <div className={styles.sheetThreads}>
              {catalog.threads
                .filter((th) => th.objects.includes(open.id))
                .map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    className={styles.sheetThread}
                    onClick={() => {
                      setThreadId(th.id);
                      setOpen(null);
                    }}
                  >
                    {t('town.sheet.thread', { name: th.name, count: th.objects.length - 1 })}
                  </button>
                ))}
            </div>
            <div className={styles.sheetActions}>
              <span className={styles.sheetState}>
                {openState === 'soon'
                  ? t('town.sheet.soon')
                  : openState === 'locked' && blocker
                    ? t('town.sheet.opensAfter', { lesson: blocker.question })
                    : !open.built
                      ? t('town.sheet.soonLesson')
                      : openState === 'done'
                        ? t('town.sheet.lit')
                        : t('town.sheet.minutes', { minutes: open.minutes })}
              </span>
              <Button
                size="lg"
                data-autofocus
                disabled={!canStart}
                onClick={() => navigate(`/lesson/${open.lesson}`)}
              >
                {!open.built || openState === 'soon'
                  ? t('town.sheet.soon')
                  : openState === 'done'
                    ? t('town.sheet.again')
                    : t('town.sheet.start')}
              </Button>
            </div>
          </>
        ) : null}
      </BottomSheet>
    </div>
  );
}
