/** A minimal valid lesson used by schema and runtime tests. */
export function lessonFixture(): Record<string, unknown> {
  return {
    id: 'chem.ice-floats',
    number: 1,
    title: 'Why does ice float?',
    subject: 'chemistry',
    object: 'kitchen/glass',
    threads: ['particles'],
    needs: [],
    concepts: ['density', 'states-of-matter'],
    card: 'Ice floats because freezing water spreads out.',
    summary: {
      play: 'Frozen water takes more room.',
      deep: 'Ice Ih is less dense than liquid water.',
    },
    blurb: 'Drop things into water, then zoom in on freezing molecules.',
    facts: [{ text: 'Ice density about 0.92 g/cm3 at 0 C', source: 'CRC Handbook' }],
    steps: [
      {
        type: 'hook',
        title: 'Why does ice float?',
        sim: { kind: 'tank', items: ['ice', 'stone'] },
        lumi: {
          mood: 'wow',
          play: 'Ice is hard like a stone.',
          deep: 'Water is a rare exception.',
        },
      },
      {
        type: 'poke',
        title: 'Sink or float?',
        sim: { kind: 'tank', labels: true },
        tray: [
          { id: 'coin', label: 'Coin' },
          { id: 'cork', label: 'Cork' },
          { id: 'ice', label: 'Ice cube' },
          { id: 'apple', label: 'Apple' },
        ],
        lumi: { play: 'Tap a thing to drop it in.' },
        done_when: "count(dropped) >= 3 && has(dropped, 'ice')",
        reactions: { 'dropped:coin': { mood: 'wow', play: 'Plop!' } },
        done_lumi: { play: 'Tap Continue.' },
      },
      {
        type: 'predict',
        title: 'We freeze a bottle of water. What happens?',
        lumi: { mood: 'thinking', play: 'Guess first!' },
        choices: [
          { id: 'smaller', label: 'Less space', art: 'bottle:small' },
          { id: 'same', label: 'Stays the same', art: 'bottle:same' },
          { id: 'bigger', label: 'More space', art: 'bottle:big' },
        ],
        answer: 'bigger',
        hints: [
          { play: 'Not quite. The ice floated...' },
          { play: 'Here is a clue.', highlight: 'bigger' },
          { play: 'Watch this.', demo: { kind: 'tank', items: ['ice'], labels: true } },
        ],
        reveal: { play: 'It takes up more space.' },
        correct: { mood: 'proud', play: 'Yes!' },
      },
      {
        type: 'zoom',
        title: 'Zoom in. Way in.',
        sim: { kind: 'molecules' },
        controls: [
          {
            type: 'slider',
            param: 'temperature',
            label: 'Temperature',
            min: -10,
            max: 20,
            step: 1,
            start: 20,
            unit: '°C',
          },
        ],
        lumi: { play: 'Slide the temperature down.' },
        done_when: "event('froze')",
        done_lumi: { mood: 'wow', play: 'Frozen!' },
      },
      {
        type: 'name_it',
        title: 'Ice is less *dense* than water.',
        term: 'density',
        body: { play: 'Same water, more space.' },
        lumi: { mood: 'proud', play: 'A real science word!' },
      },
      {
        type: 'challenge',
        title: 'Your turn: float or sink?',
        lumi: { play: 'Tap Floats or Sinks.' },
        sort: {
          bins: [
            { id: 'floats', label: 'Floats' },
            { id: 'sinks', label: 'Sinks' },
          ],
          items: [
            { id: 'log', name: 'Wooden log', detail: '0.7 g/cm³', bin: 'floats' },
            { id: 'stone', name: 'Stone', detail: '2.6 g/cm³', bin: 'sinks' },
          ],
          not_quite: { play: 'Not quite! Is a {name} packed tighter than water?' },
          done: { mood: 'proud', play: 'All correct!' },
        },
        then: {
          sim: { kind: 'lake' },
          toggle: {
            param: 'mode',
            off: { value: 'real', label: 'Back to the real world', lumi: { play: 'Phew.' } },
            on: {
              value: 'sank',
              label: 'What if ice sank?',
              lumi: { mood: 'wow', play: 'Oh no!' },
            },
          },
        },
      },
      {
        type: 'keep',
        lumi: { mood: 'proud', play: 'You did it!' },
        where_else: [
          {
            title: 'The kettle',
            text: 'Steam is the same tiny pieces.',
            lesson: 'chem.kettle-boil',
          },
        ],
      },
    ],
  };
}
