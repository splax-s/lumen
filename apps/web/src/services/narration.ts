/**
 * Read-aloud. A recorded audio file is used when one exists for the line; otherwise the
 * browser's speech synthesis reads the text. If neither is possible the service reports
 * itself unavailable and the read-aloud button is not shown.
 */

type SynthLike = { speak(utterance: never): void; cancel(): void };
type UtteranceLike = new (text: string) => { rate: number; pitch: number; lang: string };

export type NarrationDeps = {
  synth: SynthLike | undefined;
  Utterance: UtteranceLike | undefined;
  /** Line id to audio URL, for pre-recorded narration. */
  recordings?: Record<string, string>;
  playAudio?: (url: string) => { stop(): void };
  lang?: string;
};

export type Narration = {
  available(): boolean;
  speak(text: string, lineId?: string): void;
  stop(): void;
};

export function createNarration(deps: NarrationDeps): Narration {
  let playing: { stop(): void } | null = null;
  const canSpeak = deps.synth !== undefined && deps.Utterance !== undefined;
  const hasRecordings = deps.playAudio !== undefined && Object.keys(deps.recordings ?? {}).length > 0;

  const stop = () => {
    try {
      playing?.stop();
      deps.synth?.cancel();
    } catch {
      // Some browsers throw if speech is blocked. Nothing to stop in that case.
    }
    playing = null;
  };

  return {
    available: () => canSpeak || hasRecordings,
    speak(text, lineId) {
      if (text.trim() === '') return;
      stop();
      const recording = lineId !== undefined ? deps.recordings?.[lineId] : undefined;
      try {
        if (recording !== undefined && deps.playAudio) {
          playing = deps.playAudio(recording);
          return;
        }
        if (deps.synth && deps.Utterance) {
          const utterance = new deps.Utterance(text);
          utterance.rate = 0.95;
          utterance.pitch = 1.1;
          utterance.lang = deps.lang ?? 'en';
          deps.synth.speak(utterance as never);
        }
      } catch {
        // Speech can be refused before the first tap. The text is still on screen.
      }
    },
    stop,
  };
}

function playAudio(url: string): { stop(): void } {
  const audio = new Audio(url);
  void audio.play().catch(() => {});
  return {
    stop: () => {
      audio.pause();
    },
  };
}

const hasWindow = typeof window !== 'undefined';

/** The app's narration service. Recordings are registered here as they are produced. */
export const narration: Narration = createNarration({
  synth: hasWindow && 'speechSynthesis' in window ? (window.speechSynthesis as unknown as SynthLike) : undefined,
  Utterance:
    hasWindow && 'SpeechSynthesisUtterance' in window
      ? (window.SpeechSynthesisUtterance as unknown as UtteranceLike)
      : undefined,
  recordings: {},
  playAudio: hasWindow && 'Audio' in window ? playAudio : undefined,
});
