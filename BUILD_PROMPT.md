# Lumen: Build Brief

You are building **Lumen**, a web-first learning platform where people learn science by playing with simulations. This document is the complete specification. Every decision here is final unless it is listed under "Open decisions". Read it fully before writing code. Reference files are in `reference/` (see section 17).

Work in phases (section 15). At the end of each phase, stop, summarise what you built, list anything you could not do, and wait for review.

---

## 1. Product in one paragraph

Lumen turns maths, physics, chemistry, biology and music into hands-on simulations. Every lesson is about 5 minutes long and lives inside a real, recognisable object in an illustrated town (a glass of ice water, a kettle, a swing, a sunflower, a guitar). A guide character called **Lumi** helps by asking before telling. Finishing a lesson paints that object in its real colours, so the learner's progress is a place they can see. Ideas link across subjects through **threads** (for example "Waves" connects the guitar, the drum, the radio dish and the telescope). Think Brilliant.org, but simulation-first, more visual, and built for children first while still working for adults.

## 2. Non-negotiable principles

1. **Kid's mind first, all ages welcome.** If a 9-year-old can do it, a 40-year-old will enjoy it. Design for the child, then add depth.
2. **The simulation is the lesson.** Learners touch something within 10 seconds of starting a lesson. No walls of text.
3. **Feel it first, name it second, show the maths last (or never).** Vocabulary comes after the experience.
4. **Real things, not abstract geometry.** The map and lessons use real, recognisable objects drawn in a clean illustrated style. Never abstract node graphs as the main view.
5. **Everything links.** Every lesson belongs to at least one thread that connects it to lessons in other subjects.
6. **Subjects are equal.** Maths, physics, chemistry, biology and music all ship at launch with the same weight. No subject is the hero.
7. **Ask before telling.** Lumi never gives an answer before at least two hints.
8. **Failure is fun.** Breaking the simulation is part of learning ("You froze the whole lake! Now melt it.").
9. **Web first.** It must run well on cheap Android phones and old school PCs in a browser.
10. **Scientific accuracy.** Every number, unit and claim shown to learners must be correct. When simplifying for young learners, simplify the wording, never the truth.

## 3. Audience and depth levels

One lesson serves every age through three depth levels. The simulation is identical across depths; only the text, the numbers shown and the challenge difficulty change. The learner picks a depth once (default Play) and can switch at any time, including mid-lesson.

| Depth | Typical age | What changes |
|---|---|---|
| **Play** | 6–10, or anyone new | Simple words, voice narration on, no numbers, "more" and "less" |
| **Explain** | 11–15, curious adults | Real terms, simple numbers, the "why" |
| **Deep** | 16+, exam prep | Formulas, units, graphs, harder challenges |

Every learner-facing string in a lesson is written three times, once per depth. If a depth's text is missing, fall back to Explain, then Play.

## 4. Lesson design

### 4.1 Rules
- One idea per lesson, about 5 minutes.
- At most 12 words on screen at a time outside Lumi's bubble.
- Every screen can be read aloud.
- Every lesson ends with a takeaway card added to the learner's collection.

### 4.2 Lesson skeleton (fixed order)
1. **Hook:** a one-line question, with the simulation already moving.
2. **Poke:** free play with one control and a small goal.
3. **Predict:** pick one of three pictures before the answer is shown.
4. **Reveal / Zoom in:** the simulation shows why.
5. **Name it:** introduce the real term, now that the learner has seen it.
6. **Challenge:** a small puzzle using the idea, plus a "what if" twist where it fits.
7. **Keep:** the takeaway card, "Where else does this show up?" links (threads), and the return to the town, where the object lights up.

### 4.3 Interaction types (the only ones the engine needs at launch)
`slide`, `drag`, `predict`, `sort`, `build`, `draw`, `tap_to_explore`. Each is a reusable component, configured by the lesson script.

### 4.4 Hint ladder (applies to predict, challenge and any step with a right answer)
1. **Nudge:** a question that points the right way.
2. **Clue:** the relevant part of the simulation is highlighted.
3. **Demo:** the simulation runs a worked example.
4. Only then is the answer shown. The concept is marked for spaced review.

Lumi says "Not quite", never "Wrong".

### 4.5 Reference lesson: "Why does ice float?" (build this one first)
A fully working version is in `reference/prototype-town-and-ice-lesson.html`. Reproduce its behaviour exactly in the real codebase, restyled to the final design system.

- **Hook:** an ice cube floats next to a sunken stone. "Ice is hard like a stone. Why doesn't it sink?"
- **Poke:** tap to drop a coin (8.9 g/cm³), a cork (0.24), an ice cube (0.92) and an apple (0.8) into a water tank. Floaters settle at a depth where the submerged fraction equals density ÷ 1.00. Labels by depth: Play "Floats!/Sinks", Explain "Floats · 92% under", Deep "ρ 0.92 g/cm³ · 92% under". Continue when at least 3 items are dropped, including ice.
- **Predict:** "We fill a bottle with water and freeze it. What happens?" Choices: less space / same / more space (correct). Hint ladder applies.
- **Zoom in:** about 48 water molecules (red O, white H, 104.5° H–O–H angle). A temperature slider from 20 °C to −10 °C. Below 0 °C the molecules move into a hexagonal lattice with dashed hydrogen bonds, and the container widens to show "Space taken: 109%". Continue once frozen.
- **Name it:** "Ice is less **dense** than water." Deep adds ρ = m/V, water 1.00 g/cm³ (4 °C), ice 0.92 g/cm³ (0 °C), and the note that water is a rare exception.
- **Challenge:** sort six items into Floats/Sinks: wooden log 0.7 F, stone 2.6 S, iceberg 0.92 F, steel bolt 7.8 S, cooking oil 0.92 F, honey 1.42 S. Then a lake scene with fish and a "What if ice sank?" toggle. In the real world ice forms a thin lid on top and the fish survive. In the pretend world the lake freezes from the bottom up and the fish get trapped.
- **Keep:** card "Ice floats because freezing water spreads out." Where else: the kettle (particles escaping as steam), icebergs (about 90% hidden), burst pipes in winter.

## 5. The town (progress map)

### 5.1 Concept
A single illustrated, cut-away scene: a house with a **rooftop terrace** (a flat roof with a water tank, as common in Lagos), an upstairs **music room**, a downstairs **kitchen**, a **garden** and a **playground**, with the sky above. Every lesson lives inside one real object. Objects start as light grey line drawings. A completed lesson paints its object in its real colours and makes it come alive (the kettle steams, the swing swings).

### 5.2 Object states
- `done`: real colours, a small subject-coloured check badge, and an idle animation.
- `next`: a dashed yellow ring and a "Start here" / "Next up" tag. Only one or two at a time.
- `available`: drawn normally, tappable.
- `locked`: shown, with "Opens after: [lesson]" in its info sheet.

Tapping an object opens a bottom sheet with the subject and place, the lesson question, a one-line description of what you'll play with, its threads, and a Start button.

### 5.3 Threads
Toggling a thread chip draws an animated dashed path between its objects and dims everything else. Launch threads:
- **Tiny particles:** ice, kettle, baking soda, rusty gate
- **Waves:** guitar, djembe, radio dish, telescope
- **Energy:** kettle, swing, slide
- **Patterns:** sunflower, piano, djembe, moon
- **Living things:** onion, seedling, bee, beetles, sunflower
- **Measuring:** scale, seesaw, slide, dice

### 5.4 Concept web view
Older learners can switch the town to a network view of the same data (concepts as nodes, prerequisites and threads as edges). The town is the default view.

### 5.5 Rendering
The town is SVG, with each object a separate component. It must be horizontally scrollable on phones, never squashed below about 880 px wide. Respect `prefers-reduced-motion`.

## 6. Launch curriculum (20 lessons, 4 per subject)

| # | Subject | Object (place) | Lesson question | Simulation | Prerequisite |
|---|---|---|---|---|---|
| 1 | Chemistry | Glass of ice water (kitchen) | Why does ice float? | tank, molecules, lake | none |
| 2 | Chemistry | Kettle (kitchen) | Where does boiling water go? | particles + heat | 1 |
| 3 | Chemistry | Baking soda + vinegar (kitchen shelf) | Why does baking soda fizz? | reaction kinetics (A + B → products, temperature, barrier) | 2 |
| 4 | Chemistry | Rusty garden gate (garden) | Why does iron rust? | reaction with oxygen + water | 3 |
| 5 | Physics | Swing (playground) | Why does a swing keep its rhythm? | pendulum (length vs period); Deep adds the double-pendulum chaos twin | none |
| 6 | Physics | Seesaw (playground) | How can a child lift a grown-up? | lever / torque balance | none |
| 7 | Physics | Telescope (rooftop) | How do lenses make things look bigger? | ray optics | none |
| 8 | Physics | Moon (sky) | Why does the Moon change shape? | orbit + phases | 7 |
| 9 | Maths | Kitchen scale (kitchen) | How heavy is a cup of flour? | measuring, units, estimating | none |
| 10 | Maths | Sunflower (garden) | Why are sunflower seeds in spirals? | phyllotaxis, adjustable angle, golden angle 137.5° | none |
| 11 | Maths | Slide (playground) | Which slide is fastest? | slope, rise over run | 9 |
| 12 | Maths | Dice (garden bench) | Can you predict a dice roll? | chance, many-roll histogram | none |
| 13 | Biology | Onion (kitchen) | What is an onion made of? | zoom to cells | none |
| 14 | Biology | Seedling in pot (garden) | What does a seed need to grow? | light / water / warmth time-lapse | 13 |
| 15 | Biology | Bee (garden) | Why do flowers need bees? | pollination | 14 |
| 16 | Biology | Beetles under a leaf (garden) | How do living things change over time? | natural selection (speed and sight genes, food, mutation, live trait chart). Darwin's three conditions: variation, inheritance, unequal survival | 15 |
| 17 | Music | Guitar (music room) | Where does a guitar's sound come from? | string vibration, tension and length vs pitch | none |
| 18 | Music | Djembe (music room) | How does a drum keep a beat? | rhythm on a beat circle, loop and remix | none |
| 19 | Music | Piano (music room) | Why do some notes sound good together? | colour-coded keys (hue = pitch class), chords | 17 |
| 20 | Music | Record player (music room) | Inside a masterpiece: Bach's Prelude in C | J.S. Bach, Prelude No. 1 in C major, BWV 846 (public domain): piano roll, one chord per bar, tempo control, chord names | 19 |

Additional town objects with lessons in the next release: radio dish (rooftop, Waves), Fourier speaker ("How circles draw any sound").

Reference implementations of several simulations (Fourier epicycles, double pendulum with chaos twin, reaction kinetics, natural selection, Bach Prelude with Web Audio and correct chords for bars 1–19) are in `reference/prototype-simulation-lab.html`. Port their physics and data; replace their styling.

### Roadmap after launch (do not build yet, but keep the data model ready)
Second course per subject, then new "shelves" in the town: an art museum walk, history in maps, the night sky, human anatomy. Every finished course unlocks its simulations as a free-play **sandbox**.

## 7. Lumi (guide character)

### 7.1 Look
A small, round, warm-yellow (#FFC21A) creature with a thin dark outline, two oval eyes, pink cheeks, small dark feet, and a curved stalk on its head ending in a glowing bulb. It idles with a gentle bob and an occasional blink. SVG source is in `reference/design/Lumi.dc.html` and the prototypes.

### 7.2 Moods (one SVG per mood)
- **happy:** default, greetings, instructions
- **thinking:** predictions and hints (bulb dims)
- **wow:** surprises and reveals
- **proud:** correct answers and finished lessons (bulb blazes)

### 7.3 Personality and voice
Curious, warm, a little clumsy, and learns alongside you ("Wait, why did that happen?"). It never lectures, never says "wrong", never gives the answer before two hints, never talks about anything other than science, and never asks a child for personal details. Older learners can switch Lumi to a plain, quiet assistant style.

### 7.4 Where Lumi appears
In a strip at the bottom of every lesson and under the town map: Lumi on the left, a speech bubble with a read-aloud button, and navigation on the right.

## 8. AI tutor

### 8.1 What it does
- **Watches the simulation:** it receives engine events (for example `died`, `froze`, `collided`) plus learner state, and comments on what the learner actually did.
- **Follows the hint ladder** (section 4.4).
- **Diagnoses misconceptions** behind wrong answers and links the learner to the lesson that fixes them.
- **Explains at the learner's depth and age.**
- **Tap anything, ask anything,** limited to science.
- **Generates new challenge variants** inside existing simulations.
- **Writes weekly parent and teacher summaries.**

### 8.2 Cost and risk control
Scripted Lumi lines from the lesson file cover most moments with no AI call at all. Call the model only for free-form questions, misconception diagnosis, generated variants and reports.

### 8.3 Implementation
- Provider: the Anthropic Claude API, called **only from the backend**, never from the browser. The model name lives in configuration (`LUMI_MODEL`).
- Every model reply passes a safety and accuracy check before it is shown: it must be on-topic (science only), age-appropriate for the learner's depth, free of personal-data requests, and consistent with the lesson's facts. On failure, fall back to a scripted line.
- The system prompt includes the lesson ID, step, depth, recent engine events, hint level reached, and the lesson's fact sheet.

### 8.4 Child safety (non-negotiable)
- Under-13 profiles get no free-text chat by default. They get picture prompts and suggested questions instead. A parent can unlock more.
- Child profiles store a first name or nickname only, plus an avatar. No email, photo, location or school name for children.
- Parent account (adult email) owns child profiles.
- No ads, no third-party trackers in the learner app.
- Compliance: Nigeria Data Protection Act 2023 (NDPA), COPPA and GDPR-K principles. Keep a data map, collect the minimum, support deletion and export.

## 9. Design system (final)

The final look is **calm and clean, in the spirit of Brilliant**: mostly white and black, with colour reserved for illustrations, simulations, small subject markers and Lumi. Aim for about 90% neutral and 10% colour. The visual source of truth is `reference/design/` (landing page, colour and type, Lumi, town, lesson, phone, engine boards).

### 9.1 Neutrals
| Token | Hex | Use |
|---|---|---|
| `white` | #FFFFFF | page background |
| `mist` | #F6F6F8 | alternate sections, Lumi bubbles, lesson background |
| `line` | #E6E6EC | hairline borders, dividers, inactive progress |
| `line-strong` | #D6D6DE | secondary button borders |
| `graphite` | #55555F | secondary text |
| `ink` | #16161D | text, primary buttons, done-step progress |

### 9.2 Accents (used small)
| Token | Hex | Tint | Use |
|---|---|---|---|
| `lumi` | #FFC21A | #FFF4D6 | Lumi, current step, "next" ring, streak |
| `maths` | #2F80ED | #E6F0FD | subject dot, icon tile |
| `physics` | #F2683C | #FDEBE4 | subject dot, icon tile |
| `chemistry` | #14A37F | #E1F5EF | subject dot, icon tile (chip text #0B6B53) |
| `biology` | #5AA62D | #E9F4E1 | subject dot, icon tile |
| `music` | #E0457B | #FBE4EE | subject dot, icon tile |

Simulations may use any colour that is scientifically conventional (for example CPK colours: oxygen red, hydrogen white) or needed for data. Pitch-class hue for music is hue = pitch class × 30°.

### 9.3 Type
- **Bricolage Grotesque 800:** headings and lesson questions only, with tight tracking.
- **Atkinson Hyperlegible 400/700:** body text and buttons (chosen for young and struggling readers).
- **IBM Plex Mono 500:** numbers, units, labels.
All three come from Google Fonts. Self-host them in production.

### 9.4 Components and rules
- Primary button: an ink pill with white text. Secondary: a white pill with a 1.5 px `line-strong` border. Touch targets 48 px or larger.
- Depth switch: a segmented pill (`mist` track, white selected thumb with a soft shadow).
- Cards: white, 1 px `line` border or none on `mist`, radius 16–24 px. No hard offset shadows, no thick outlines, no gradients, no emoji.
- Soft shadow only on floating elements (bottom sheets, the town frame).
- Progress dots: done = ink, current = lumi, upcoming = line.
- Subject identity is shown with a small dot or a tinted icon tile, never by filling large areas.
- Full keyboard access, visible focus rings, WCAG AA contrast, `prefers-reduced-motion` respected.
- Dark mode is a later phase; build every colour as a CSS custom property from day one.

### 9.5 Screens to build
1. **Landing page** (`reference/design/Main.dc.html`): nav, hero ("Learn science by playing with it."), the five subjects, how a lesson works (Poke, Predict, Zoom in, Keep), Meet Lumi, "Your progress is a place" (before and after), one lesson three depths, parents and schools, pricing, footer.
2. **Town** (`Town.dc.html`): header with the learner's name, per-subject progress, streak, depth switch; the town; the Lumi strip; a sidebar with the daily one-minute challenge, thread chips and recent cards.
3. **Lesson** (`Lesson.dc.html`): header with back, subject chip, step dots and depth switch; the stage; the Lumi strip with Back/Continue.
4. **Phone lesson** (`Phone.dc.html`): the same flow stacked for 390 px wide.
5. Sign-up and parent dashboard: build to the same system, no mockup yet.

## 10. Technology (decided)

| Area | Choice |
|---|---|
| Repo | pnpm monorepo with Turborepo |
| Front end | React 18 + TypeScript (strict) + Vite, PWA with offline lesson caching |
| Styling | CSS custom properties for every token, plus CSS modules |
| Town and UI art | SVG components |
| Simulations | Canvas 2D by default, PixiJS (WebGL) for heavy scenes |
| Physics | small custom solvers per simulation (RK4 where needed), no general physics engine at launch |
| Audio | Tone.js on Web Audio, sampled piano for music lessons |
| Narration | pre-recorded audio per line where available, Web Speech API as fallback |
| Lesson content | YAML files in Git, validated with Zod at build time |
| Back end | Python 3.12 + FastAPI, SQLAlchemy 2 + Alembic |
| Database | PostgreSQL 16; Redis for sessions and rate limits |
| AI | Anthropic Claude API via the backend only |
| Storage | S3-compatible object storage + CDN for art, audio and lesson bundles |
| Hosting | containers; one VM + managed Postgres at launch. Region and provider: see Open decisions. Learner data must be stored where NDPA requires |
| Testing | Vitest + Testing Library (web), Playwright (end to end), pytest (API) |
| Quality | ESLint, Prettier, Ruff, mypy; CI on every push |

### 10.1 Suggested structure
```
lumen/
  apps/
    web/            # React app: landing, town, lessons, parent dashboard
    api/            # FastAPI service
  packages/
    engine/         # simulation kit, interaction kit, event bus, lesson runtime
    lessons/        # YAML lesson files + Zod schema + build-time validator
    design/         # tokens.css, fonts, Lumi SVGs, shared UI components
    town/           # town scene + object components
  reference/        # prototypes and mockups (read-only)
```

## 11. Lesson engine

### 11.1 Modules
- **Simulation kit:** `tank` (buoyancy), `molecules` (states of matter), `lake`, `particles` (heat, gas), `kinetics` (reactions), `pendulum` (single + double, RK4), `lever`, `optics` (rays and lenses), `orbit`, `phyllotaxis`, `slope`, `dice`, `cells` (zoom), `growth`, `pollination`, `selection` (evolution), `string` (vibration), `beat_circle`, `keyboard`, `piano_roll`. Each simulation is a class with `init(config)`, `step(dt)`, `render(ctx)`, `setParam(key, value)` and `emit(event)`.
- **Interaction kit:** the seven interaction types (section 4.3).
- **Event bus:** typed events from simulations (`dropped`, `settled`, `froze`, `melted`, `reacted`, `died`, `born`, `collided`, `played_note`, ...).
- **Lesson runtime:** loads a lesson file, runs its steps, evaluates `done_when` conditions against events and state, drives Lumi lines by depth and mood, runs the hint ladder, and records attempts.

### 11.2 Lesson file schema (YAML, validated with Zod)
```yaml
id: chem.ice-floats
title: Why does ice float?
subject: chemistry
object: kitchen/glass
threads: [particles]
needs: []
concepts: [density, states-of-matter]
card: "Ice floats because freezing water spreads out."
facts:            # the accuracy reference the AI tutor must stay consistent with
  - "Ice density about 0.92 g/cm3 at 0 C; liquid water 1.00 g/cm3 at 4 C"
  - "Water expands about 9% on freezing"
steps:
  - type: hook
    sim: { kind: tank, items: [ice, stone] }
    lumi:
      mood: wow
      play: "Ice is hard like a stone. So why doesn't it sink?"
      explain: "Ice is just solid water. Most solids sink in their own liquid. Ice doesn't."
      deep: "Most substances are denser as solids than as liquids. Water is a rare exception."
  - type: poke
    sim: { kind: tank, tray: [coin, cork, ice, apple] }
    done_when: "count(dropped) >= 3 && has(dropped, 'ice')"
    reactions: { coin: {play: "...", explain: "...", deep: "..."} }
  - type: predict
    question: { play: "...", explain: "...", deep: "..." }
    choices: [smaller, same, bigger]
    answer: bigger
    hints: [{play: "...", ...}, {highlight: bigger, play: "..."}]
  - type: zoom
    sim: { kind: molecules, control: { temperature: { min: -10, max: 20, start: 20 } } }
    done_when: "event('froze')"
  - type: name_it
    term: density
  - type: challenge
    sort: [log, stone, iceberg, bolt, oil, honey]
    then: { sim: { kind: lake, toggle: ice_sinks } }
  - type: keep
    where_else: [chem.kettle-boil, phys.iceberg-fact, everyday.burst-pipes]
```
Write `ice-floats.yaml` in full first, exactly matching section 4.5, and use it as the template for the other 19.

## 12. Data model (initial)

- `parent_account` (id, email, password hash, country, consent records, created_at)
- `learner_profile` (id, parent_id nullable for adult self-learners, nickname, avatar, birth_year_band, default_depth, chat_unlocked bool)
- `lesson` (id, version, subject, object, threads, needs) — synced from the YAML at deploy
- `lesson_attempt` (id, learner_id, lesson_id, started_at, finished_at, depth, steps json, hints_used)
- `concept_mastery` (learner_id, concept_id, score 0–1, last_seen, next_review_at), using a simple spaced-review schedule
- `card` (learner_id, lesson_id, earned_at)
- `streak` (learner_id, current, longest, rest_days_left)
- `tutor_message` (id, learner_id, lesson_id, role, text, safety_result, created_at), retained 90 days
- `school`, `class`, `assignment` (phase 4)

## 13. API (initial)

`POST /auth/signup` (parent or adult) · `POST /auth/login` · `GET/POST /profiles` · `GET /town` (object states, threads, cards, streak) · `GET /lessons/:id` · `POST /attempts` · `PATCH /attempts/:id` (step progress, events summary) · `POST /attempts/:id/complete` · `POST /lumi/ask` (free question, rate-limited, safety-checked) · `POST /lumi/diagnose` (wrong answer → misconception + linked lesson) · `GET /parent/report/weekly` · `DELETE /profiles/:id` and `GET /profiles/:id/export` (data rights).

## 14. Business

- **Free:** the first lesson of every course, the town, and scripted Lumi hints.
- **Family:** [PRICE] per month, a 7-day free trial, every lesson, the full AI tutor, up to [N] child profiles, weekly parent reports.
- **School:** [PRICE] per pupil per year, teacher dashboards, assignments, curriculum mapping.
- Prices in naira for Nigeria, in USD elsewhere. Payments are a later phase; design the entitlement checks now.

## 15. Phases and acceptance criteria

**Phase 1 — Foundations and the reference lesson**
- Monorepo, tooling, CI, design tokens, fonts, Lumi SVG components with the four moods.
- Engine core: event bus, lesson runtime, Zod schema, interaction kit (predict, sort, slide, tap/drop).
- Simulations: `tank`, `molecules`, `lake`.
- `ice-floats.yaml` complete; the lesson fully playable at all three depths with the hint ladder and read-aloud.
- Done when: the lesson matches section 4.5 step by step; it plays smoothly at 60 fps on a mid-range Android phone in Chrome; it works at 390 px width; it is keyboard accessible; unit tests cover the runtime and the `done_when` evaluator; there is a Playwright test of the full lesson.

**Phase 2 — Town and progress**
- The town scene with all 20 objects in their four states, the bottom sheet, threads, the Lumi strip, cards and streaks. Progress is stored locally first, then synced to the API.
- Done when: finishing the ice lesson paints the glass and marks the kettle as next; thread toggles work; the town scrolls correctly on a phone.

**Phase 3 — Backend, accounts, AI tutor**
- FastAPI, Postgres, auth, parent and child profiles, attempts, mastery, the weekly report.
- Lumi service with the safety layer and fallbacks; `/lumi/ask` and `/lumi/diagnose`.
- Done when: under-13 profiles cannot reach free text chat; every tutor reply is logged with its safety result; deleting a profile removes all its data.

**Phase 4 — The remaining 19 lessons, the landing page, schools**
- Build the remaining simulations and lessons in the order of section 6, one subject at a time, round-robin so all subjects advance together.
- Landing page matching `reference/design/Main.dc.html`, responsive.
- Teacher dashboard and class assignments.

**Phase 5 — Polish and launch**
- Sampled audio, recorded narration, offline caching, performance budgets (first load under 200 KB JavaScript for the landing page), analytics without third-party trackers, dark mode.

## 16. Things not to do
- Do not invent scientific values. Look them up and cite them in the lesson's `facts`.
- Do not call the AI from the browser or put API keys in the front end.
- Do not let any one subject dominate the visuals or the order of work.
- Do not use abstract node graphs as the main map, emoji as icons, gradients, thick cartoon outlines on UI, or hard offset shadows.
- Do not add features outside this brief without asking. Note ideas under "Open decisions" instead.
- Do not reproduce copyrighted music. Use public-domain pieces (for example Bach) or original compositions.

## 17. Reference files (`reference/`)
- `prototype-town-and-ice-lesson.html`: a working town map with 17 objects, threads, a bottom sheet, the Lumi strip, and the complete "Why does ice float?" lesson with tank, molecules and lake simulations, the hint ladder and depth switching. **Behaviour reference** (its ink-and-paper styling is outdated; use section 9).
- `prototype-simulation-lab.html`: working Fourier epicycles, double pendulum with a chaos twin (RK4), reaction kinetics, natural selection with a trait chart, and the Bach Prelude in C (bars 1–19 with correct chords, Web Audio). **Physics and data reference**.
- `design/*.dc.html`: the final visual mockups (Main = landing, Colors, Lumi, Town, Lesson, Phone, Engine). Each is HTML with inline styles inside an `<x-dc>` wrapper; read the markup and styles as the visual spec. **Visual source of truth.**

## 18. Open decisions (ask the owner; use the default until answered)
1. Cloud provider and region for learner data. Default: a provider with a region that satisfies NDPA.
2. Prices and the child-profile limit for Family. Default: placeholders.
3. Curriculum mapping (Nigerian basic science, WAEC/JAMB, Cambridge). Default: general science, with tags ready for mapping later.
4. Languages beyond English (Yoruba, Igbo, Hausa, Pidgin narration). Default: English only, with all strings in i18n files from day one.
5. Final product name. Default: Lumen, with Lumi as the guide.
