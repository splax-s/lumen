import { GROUND_Y, TOWN_HEIGHT, TOWN_WIDTH } from './layout';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function Cloud({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <path
      className="cloud"
      transform={`translate(${x},${y}) scale(${scale})`}
      d="M0,30 C-4,14 14,6 24,14 C30,0 56,0 60,16 C76,10 90,22 82,32 Z"
    />
  );
}

/**
 * The fixed scenery: a cut-away house with a rooftop terrace and water tank, the music room
 * upstairs, the kitchen downstairs, then the garden and the playground under the sky.
 */
export function Backdrop({ places }: { places: Record<string, string> }) {
  return (
    <g aria-hidden="true">
      <rect className="sky" x="0" y="0" width={TOWN_WIDTH} height={TOWN_HEIGHT} />
      <Cloud x={720} y={70} scale={1} />
      <Cloud x={1010} y={44} scale={0.8} />
      <Cloud x={1250} y={130} scale={0.7} />

      <rect
        className="ground"
        x="0"
        y={GROUND_Y}
        width={TOWN_WIDTH}
        height={TOWN_HEIGHT - GROUND_Y}
      />
      <path className="scene" d={`M0,${GROUND_Y} H${TOWN_WIDTH}`} />
      <path
        className="scene thin"
        d={range(74)
          .map((i) => {
            const x = 620 + i * 14 + (i % 3) * 3;
            return `M${x},${GROUND_Y} l3,-7 M${x + 5},${GROUND_Y} l-2,-5`;
          })
          .join(' ')}
      />

      {/* House */}
      <rect className="wall" x="40" y="170" width="560" height="470" />
      <rect className="room roomA" x="46" y="176" width="548" height="218" />
      <rect className="room roomB" x="46" y="406" width="548" height="231" />
      <rect className="solid" x="40" y="396" width="560" height="10" />
      <rect className="wall" x="28" y="156" width="584" height="14" />
      <path className="scene" d="M28,156 V140 M612,156 V140 M28,140 H70 M570,140 H612" />

      {/* Rooftop water tank */}
      <rect className="solid" x="318" y="110" width="58" height="42" rx="6" />
      <ellipse className="soft" cx="347" cy="110" rx="29" ry="6" />
      <path className="scene" d="M326,152 V156 M368,152 V156" />

      {/* Music room: a picture on the wall and a rug */}
      <rect className="scene paper" x="236" y="204" width="52" height="40" />
      <path className="scene thin" d="M243,238 L254,222 L263,232 L270,226 L281,238" />
      <ellipse className="rug" cx="300" cy="392" rx="130" ry="5" />

      {/* Kitchen: window, shelf, counter, cooker */}
      <rect className="scene window" x="240" y="428" width="112" height="78" />
      <path className="scene" d="M296,428 V506 M240,467 H352" />
      <path className="scene" d="M70,482 H210 M80,482 l8,10 M200,482 l-8,10" />
      <rect className="solid" x="56" y="582" width="328" height="8" rx="2" />
      <rect className="scene paper" x="60" y="590" width="320" height="47" />
      <path className="scene" d="M140,590 V637 M220,590 V637 M300,590 V637" />
      <rect className="scene paper" x="405" y="560" width="170" height="77" />
      <circle className="scene" cx="430" cy="600" r="6" />
      <circle className="scene" cx="455" cy="600" r="6" />
      <rect className="scene room" x="490" y="582" width="72" height="44" />

      {/* Garden fence either side of the gate */}
      <path className="scene" d="M600,600 H626 M726,600 H770 M600,624 H626 M726,624 H770" />
      <path className="scene" d="M612,640 V590 M740,640 V590 M758,640 V590" />

      <text className="place" x="58" y="198">
        {places['music-room']}
      </text>
      <text className="place" x="400" y="430">
        {places.kitchen}
      </text>
      <text className="place" x="214" y="146">
        {places.rooftop}
      </text>
      <text className="place" x="640" y="676">
        {places.garden}
      </text>
      <text className="place" x="1160" y="676">
        {places.playground}
      </text>
    </g>
  );
}
