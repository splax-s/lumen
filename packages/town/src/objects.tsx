import type { ReactNode } from 'react';

/**
 * The drawing for each town object. Shapes use a few shared classes so one stylesheet can show
 * an object as a pencil sketch (not yet learned) or in its real colours (lesson finished):
 *   f, f2, f3  filled with the object's first, second or third colour once lit
 *   o          always paper, with an outline
 *   l, t       lines and thin lines
 *   k          solid dark detail
 *   w          water or glass tint, shown once lit
 * Coordinates are in town space.
 */

export type ObjectArt = { colors: [string, string?, string?]; draw: () => ReactNode };

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const OBJECT_ART: Record<string, ObjectArt> = {
  glass: {
    colors: ['#E3F5FF'],
    draw: () => (
      <g transform="translate(95,512)">
        <path className="w" d="M4,24 L8,74 L44,74 L48,24 Z" />
        <rect
          className="f"
          x="10"
          y="18"
          width="15"
          height="15"
          rx="3"
          transform="rotate(-12 17 25)"
        />
        <rect
          className="f"
          x="27"
          y="20"
          width="14"
          height="14"
          rx="3"
          transform="rotate(10 34 27)"
        />
        <path className="t" d="M4,24 Q26,28 48,24" />
        <path className="l" d="M0,0 L7,74 L45,74 L52,0" />
      </g>
    ),
  },
  kettle: {
    colors: ['#F2683C', '#2C2F35'],
    draw: () => (
      <g transform="translate(451,492)">
        <g className="steam">
          <path className="t" d="M88,6 q-6,-8 0,-16 q6,-8 0,-16" />
          <path className="t late" d="M98,10 q-6,-8 0,-16 q6,-8 0,-16" />
        </g>
        <path className="f" d="M64,38 L86,18 L92,24 L68,52 Z" />
        <path className="f" d="M2,62 C-2,24 12,10 34,10 C56,10 70,24 66,62 Z" />
        <path className="l" d="M12,16 C14,-14 54,-14 56,16" />
        <ellipse className="f2" cx="34" cy="10" rx="13" ry="4" />
        <circle className="f2" cx="34" cy="4" r="3" />
      </g>
    ),
  },
  'baking-soda': {
    colors: ['#F3E7C6', '#FF8A3D'],
    draw: () => (
      <g transform="translate(80,430)">
        <path
          className="f"
          d="M9,0 L17,0 L17,14 C24,18 26,24 26,30 L26,52 L0,52 L0,30 C0,24 2,18 9,14 Z"
        />
        <rect className="o" x="3" y="31" width="20" height="12" />
        <rect className="f2" x="36" y="20" width="34" height="32" rx="2" />
        <rect className="o" x="41" y="28" width="24" height="14" />
      </g>
    ),
  },
  scale: {
    colors: ['#FF6B5E', '#FFFFFF'],
    draw: () => (
      <g transform="translate(183,532)">
        <rect className="f" x="2" y="12" width="60" height="38" rx="9" />
        <rect className="o" x="26" y="7" width="12" height="7" />
        <ellipse className="f2" cx="32" cy="7" rx="34" ry="6" />
        <circle className="f2" cx="32" cy="31" r="12" />
        <path className="t" d="M32,31 L39,23 M24,23 l1.5,1.5 M32,20 v2 M40,23 l-1.5,1.5" />
      </g>
    ),
  },
  onion: {
    colors: ['#A85AA8'],
    draw: () => (
      <g transform="translate(298,536)">
        <path
          className="f"
          d="M22,0 C24,10 36,18 42,28 C48,40 38,44 22,44 C6,44 -4,40 2,28 C8,18 20,10 22,0 Z"
        />
        <path className="t" d="M22,6 C14,18 10,30 14,44 M22,6 C30,18 34,30 30,44" />
      </g>
    ),
  },
  piano: {
    colors: ['#7A5240', '#F4EFE6'],
    draw: () => (
      <g transform="translate(70,272)">
        <rect className="f" x="0" y="0" width="140" height="64" rx="3" />
        <rect className="f2" x="40" y="14" width="60" height="28" />
        <path className="t" d="M46,22 h48 M46,28 h40 M46,34 h44" />
        <rect className="o" x="-8" y="64" width="156" height="14" />
        {range(15).map((i) => (
          <path key={i} className="t" d={`M${(-8 + (i + 1) * 9.75).toFixed(1)},64 v14`} />
        ))}
        {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14].map((i) => (
          <rect
            key={i}
            className="k"
            x={(-8 + (i + 1) * 9.75 - 2.6).toFixed(1)}
            y="64"
            width="5.2"
            height="8"
          />
        ))}
        <rect className="f" x="0" y="78" width="140" height="44" />
        <rect className="o" x="4" y="122" width="10" height="6" />
        <rect className="o" x="126" y="122" width="10" height="6" />
      </g>
    ),
  },
  guitar: {
    colors: ['#E9A15A', '#7A5240'],
    draw: () => (
      <g transform="translate(270,262)">
        <path
          className="f"
          d="M30,40 C14,40 8,52 10,64 C12,72 4,76 2,92 C0,116 18,128 30,128 C42,128 60,116 58,92 C56,76 48,72 50,64 C52,52 46,40 30,40 Z"
        />
        <circle className="k" cx="30" cy="80" r="7" />
        <rect className="f2" x="26" y="-30" width="8" height="98" />
        <rect className="f2" x="23" y="-46" width="14" height="18" rx="3" />
        <path className="t" d="M28,-28 V106 M30,-28 V106 M32,-28 V106" />
        <rect className="o" x="21" y="104" width="18" height="5" />
      </g>
    ),
  },
  djembe: {
    colors: ['#C2774A', '#F6EAD3'],
    draw: () => (
      <g transform="translate(378,298)">
        <path className="f" d="M2,6 C2,36 20,44 20,58 L16,92 L48,92 L44,58 C44,44 62,36 62,6 Z" />
        <path className="t" d="M8,14 L16,50 L24,16 L30,54 L36,16 L42,54 L48,16 L54,46" />
        <ellipse className="f2" cx="32" cy="6" rx="31" ry="8" />
      </g>
    ),
  },
  'record-player': {
    colors: ['#3A3A44', '#E0457B', '#B98A5E'],
    draw: () => (
      <g transform="translate(476,300)">
        <path className="l" d="M10,60 V90 M86,60 V90" />
        <rect className="f3" x="0" y="34" width="96" height="26" rx="4" />
        <g className="record">
          <ellipse className="f" cx="42" cy="32" rx="34" ry="11" />
          <ellipse className="f2" cx="42" cy="32" rx="10" ry="3.4" />
          <ellipse className="k" cx="42" cy="32" rx="2" ry="0.9" />
        </g>
        <path className="l" d="M86,14 L62,30" />
        <circle className="o" cx="86" cy="14" r="5" />
      </g>
    ),
  },
  telescope: {
    colors: ['#2F80ED', '#BFD9FA'],
    draw: () => (
      <g transform="translate(110,96)">
        <path className="l" d="M36,24 L16,62 M36,24 L56,62 M36,24 L36,62" />
        <g transform="rotate(-25 36 24)">
          <rect className="f" x="0" y="16" width="78" height="16" rx="4" />
          <rect className="o" x="-10" y="19" width="12" height="10" rx="2" />
          <rect className="f2" x="74" y="13" width="10" height="22" rx="2" />
        </g>
      </g>
    ),
  },
  dish: {
    colors: ['#E8EDF2', '#F2683C'],
    draw: () => (
      <g transform="translate(470,90)">
        <path className="l" d="M34,30 V66" />
        <rect className="o" x="22" y="64" width="24" height="5" />
        <ellipse className="f" cx="30" cy="24" rx="30" ry="12" transform="rotate(-35 30 24)" />
        <path className="l" d="M30,24 L48,4" />
        <circle className="f2" cx="49" cy="3" r="4" />
      </g>
    ),
  },
  moon: {
    colors: ['#F3E9B5'],
    draw: () => (
      <g transform="translate(1508,100)">
        <path className="f" d="M0,-34 A34,34 0 1,0 0,34 A40,40 0 0,1 0,-34 Z" />
      </g>
    ),
  },
  gate: {
    colors: ['#B5532A', '#8A8F98'],
    draw: () => (
      <g transform="translate(626,520)">
        <rect className="f2" x="0" y="0" width="10" height="120" rx="2" />
        <rect className="f2" x="90" y="0" width="10" height="120" rx="2" />
        <path className="f" d="M14,22 Q50,-6 86,22 L86,112 L14,112 Z" />
        <path className="t" d="M26,18 V112 M38,10 V112 M50,7 V112 M62,10 V112 M74,18 V112" />
        <path className="l" d="M14,52 H86 M14,92 H86" />
        <circle className="k" cx="80" cy="72" r="2.6" />
      </g>
    ),
  },
  sunflower: {
    colors: ['#FFC928', '#7A4A26', '#5AA62D'],
    draw: () => (
      <g transform="translate(80,0)">
        <path className="l" d="M720,640 C714,590 728,540 720,508" />
        <path className="f3" d="M719,590 C700,572 684,580 680,590 C694,596 708,596 719,590 Z" />
        <path className="f3" d="M721,560 C740,544 756,552 760,562 C746,568 732,566 721,560 Z" />
        {range(16).map((i) => (
          <ellipse
            key={i}
            className="f"
            cx="720"
            cy="440"
            rx="7"
            ry="15"
            transform={`rotate(${i * 22.5} 720 470)`}
          />
        ))}
        <circle className="f2" cx="720" cy="470" r="21" />
        {range(60).map((i) => {
          const r = 2.5 * Math.sqrt(i + 1);
          const a = i * 2.39996;
          return (
            <circle
              key={i}
              className="k seed"
              cx={(720 + r * Math.cos(a)).toFixed(1)}
              cy={(470 + r * Math.sin(a)).toFixed(1)}
              r="1.1"
            />
          );
        })}
      </g>
    ),
  },
  bee: {
    colors: ['#FFCF3A', '#2C2F35'],
    draw: () => (
      <g transform="translate(874,436)">
        <path className="t dashes" d="M-40,30 C-30,0 -12,40 -6,10" />
        <g className="hover">
          <ellipse className="o" cx="6" cy="-10" rx="8" ry="11" transform="rotate(-20 6 -10)" />
          <ellipse className="o" cx="16" cy="-9" rx="7" ry="10" transform="rotate(20 16 -9)" />
          <ellipse className="f" cx="10" cy="6" rx="14" ry="9" />
          <path className="l" d="M6,-2 V14 M12,-3 V15" />
          <circle className="f2" cx="25" cy="4" r="6" />
          <path className="l" d="M-4,6 L-9,7" />
        </g>
      </g>
    ),
  },
  seedling: {
    colors: ['#D98A5C', '#6CC04A'],
    draw: () => (
      <g transform="translate(878,588)">
        <g className="sway">
          <path className="l" d="M30,12 V-14" />
          <path className="f2" d="M30,-8 C18,-20 6,-12 8,-4 C16,0 26,-2 30,-8 Z" />
          <path className="f2" d="M30,-14 C42,-26 54,-18 52,-10 C44,-6 34,-8 30,-14 Z" />
        </g>
        <path className="f" d="M2,18 L58,18 L53,52 L7,52 Z" />
        <rect className="f" x="-3" y="10" width="66" height="10" rx="2" />
      </g>
    ),
  },
  beetles: {
    colors: ['#5AA62D', '#C0392B', '#2C2F35'],
    draw: () => (
      <g transform="translate(962,586)">
        <path className="f" d="M0,40 C10,4 60,-8 86,14 C70,40 30,54 0,40 Z" />
        <path className="t" d="M4,38 C30,30 58,22 84,15" />
        <g>
          <ellipse className="f2" cx="26" cy="46" rx="9" ry="6.5" />
          <path className="t" d="M26,39.5 V52.5" />
          <circle className="f3" cx="36" cy="46" r="3.4" />
          <path className="t" d="M20,52 l-3,4 M26,53 v4 M32,52 l3,4" />
        </g>
        <g>
          <ellipse className="f2" cx="58" cy="42" rx="7.5" ry="5.5" />
          <path className="t" d="M58,36.5 V47.5" />
          <circle className="f3" cx="66.5" cy="42" r="3" />
          <path className="t" d="M53,47 l-3,4 M58,48 v4 M63,47 l3,4" />
        </g>
      </g>
    ),
  },
  dice: {
    colors: ['#FFFFFF', '#2F80ED', '#B98A5E'],
    draw: () => (
      <g transform="translate(1046,556)">
        <rect className="f3" x="0" y="34" width="100" height="9" rx="2" />
        <path className="l" d="M12,43 V84 M88,43 V84 M12,62 H88" />
        <rect className="f" x="22" y="8" width="26" height="26" rx="5" />
        <circle className="k" cx="29" cy="15" r="2" />
        <circle className="k" cx="35" cy="21" r="2" />
        <circle className="k" cx="41" cy="27" r="2" />
        <rect
          className="f2"
          x="54"
          y="12"
          width="22"
          height="22"
          rx="4"
          transform="rotate(12 65 23)"
        />
        <circle className="o dot" cx="61" cy="19" r="1.8" />
        <circle className="o dot" cx="70" cy="27" r="1.8" />
      </g>
    ),
  },
  swing: {
    colors: ['#F2683C'],
    draw: () => (
      <g transform="translate(1150,470)">
        <path className="l frame" d="M10,170 L40,0 L70,170 M130,170 L160,0 L190,170 M40,0 L160,0" />
        <g className="swingseat">
          <path className="l" d="M90,0 L90,118 M110,0 L110,118" />
          <rect className="f" x="80" y="116" width="40" height="8" rx="2" />
        </g>
      </g>
    ),
  },
  slide: {
    colors: ['#2F80ED', '#FFD23F'],
    draw: () => (
      <g transform="translate(1344,470)">
        <path className="l" d="M2,170 L16,30 M28,170 L42,30" />
        <path className="t" d="M5,140 h26 M8,110 h26 M11,80 h26 M14,50 h26" />
        <rect className="f2" x="12" y="24" width="44" height="9" rx="2" />
        <path
          className="f"
          d="M50,24 C80,24 92,62 110,108 C122,138 140,158 170,158 L172,170 C136,170 114,150 100,114 C84,72 74,36 50,34 Z"
        />
      </g>
    ),
  },
  seesaw: {
    colors: ['#FFB000', '#5B5F66'],
    draw: () => (
      <g transform="translate(1516,520)">
        <path className="f2" d="M50,120 L62,92 L74,120 Z" />
        <g transform="rotate(-12 62 92)">
          <rect className="f" x="12" y="86" width="100" height="8" rx="3" />
          <path className="l" d="M22,86 V74 M102,86 V74" />
        </g>
      </g>
    ),
  },
};
