/** The town is drawn in a 1680 by 700 space. These are the points each object is centred on. */
export const TOWN_WIDTH = 1680;
export const TOWN_HEIGHT = 700;
export const GROUND_Y = 640;

export const ANCHORS: Record<string, { x: number; y: number; r?: number; tag?: 'above' }> = {
  // Rooftop
  telescope: { x: 150, y: 118 },
  dish: { x: 502, y: 116 },
  // Music room
  piano: { x: 140, y: 330, r: 60 },
  guitar: { x: 300, y: 330 },
  djembe: { x: 410, y: 346 },
  'record-player': { x: 524, y: 338 },
  // Kitchen
  'baking-soda': { x: 115, y: 456, r: 44, tag: 'above' },
  glass: { x: 121, y: 548, r: 44 },
  scale: { x: 215, y: 556, r: 44 },
  onion: { x: 320, y: 558, r: 44 },
  kettle: { x: 486, y: 524 },
  // Garden
  gate: { x: 676, y: 574 },
  sunflower: { x: 800, y: 478 },
  bee: { x: 884, y: 440, r: 44 },
  seedling: { x: 908, y: 596, r: 46 },
  beetles: { x: 1004, y: 612, r: 44 },
  dice: { x: 1096, y: 580 },
  // Playground
  swing: { x: 1250, y: 556, r: 64 },
  slide: { x: 1426, y: 556, r: 62 },
  seesaw: { x: 1578, y: 600, r: 52 },
  // Sky
  moon: { x: 1500, y: 100 },
};

export function anchorOf(id: string): { x: number; y: number; r: number; tag: 'above' | 'below' } {
  const anchor = ANCHORS[id] ?? { x: TOWN_WIDTH / 2, y: TOWN_HEIGHT / 2 };
  return { x: anchor.x, y: anchor.y, r: anchor.r ?? 54, tag: anchor.tag ?? 'below' };
}
