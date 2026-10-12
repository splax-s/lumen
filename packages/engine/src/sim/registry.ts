import type { SimulationClass } from './types';

type Loader = () => Promise<{ default: SimulationClass }>;

/** Simulations load on demand, so a lesson only downloads the ones it uses. */
export const simRegistry: Record<string, Loader> = {
  tank: () => import('./tank'),
  molecules: () => import('./molecules'),
  lake: () => import('./lake'),
};

export const SIM_KINDS: readonly string[] = Object.keys(simRegistry);

export async function loadSimulation(kind: string): Promise<SimulationClass> {
  const loader = simRegistry[kind];
  if (!loader) throw new Error(`Unknown simulation "${kind}"`);
  return (await loader()).default;
}
