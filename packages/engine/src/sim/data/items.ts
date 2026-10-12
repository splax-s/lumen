/**
 * Things that can go in the water tank. Density in g/cm³ at room temperature;
 * sources are listed in the ice lesson's fact sheet.
 */
export type TankItem = {
  /** Density relative to liquid water at 1.00 g/cm³. */
  rho: number;
  /** Drawn size in tank units. */
  w: number;
  h: number;
  color: string;
};

export const TANK_ITEMS: Record<string, TankItem> = {
  coin: { rho: 8.9, w: 30, h: 6, color: '#D4A72C' },
  cork: { rho: 0.24, w: 24, h: 32, color: '#C99A66' },
  ice: { rho: 0.92, w: 34, h: 34, color: '#E3F5FF' },
  apple: { rho: 0.8, w: 38, h: 36, color: '#E2453C' },
  stone: { rho: 2.6, w: 40, h: 24, color: '#8E9196' },
};

export const WATER_DENSITY = 1.0;
