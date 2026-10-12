import { useSyncExternalStore } from 'react';
import { progress, type Progress } from './progress';

export function useProgress(): Progress {
  return useSyncExternalStore(progress.subscribe, progress.get, progress.get);
}
