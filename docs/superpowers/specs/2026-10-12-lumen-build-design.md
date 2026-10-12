# Lumen build design

Date: 2026-10-12
Status: awaiting owner review
Source of requirements: `BUILD_PROMPT.md` (the brief). This document does not restate the brief. It records how the brief will be built, where the brief is ambiguous, and what will be stubbed.

## 1. Goal and success criteria

Build all five phases of brief section 15 in one continuous run, in a single session, with a local git commit after each phase.

The run is successful when:

- Every acceptance line in section 15 is either met and verified by a test or command, or listed in `BUILD_REPORT.md` as stubbed or unverified with the reason.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e` and the API's `ruff`, `mypy` and `pytest` all pass at the final commit.
- `DECISIONS.md` records every choice made beyond the brief, and `BUILD_REPORT.md` says plainly what works, what is stubbed and what was not verified.

## 2. Instructions from the owner that override the brief

| Topic | Brief says | Owner said | What I will do |
|---|---|---|---|
| Phase reviews | Stop after each phase and wait | One continuous run | No stops between phases. Commit per phase. |
| Record keeping | Not mentioned | DECISIONS.md, BUILD_REPORT.md | Both files at the repo root. |
| Visual conflicts | Mockups are the visual source of truth | Section 9 tokens win | Section 9 colours, type and component rules everywhere. Town, Lesson, Phone and Lumi mockups are used for layout and content only. |
| AI provider | Anthropic only | Use Claude; support other AI if there is no key | Pluggable provider, Anthropic first (section 7 below). |
| Execution | Not mentioned | Single session | No subagents. |
| Ops console | Not in the brief | Add a proper, fully integrated console | A staff-only operations console (section 8). This is a feature beyond the brief, added at the owner's request. |
| Quality bar | Acceptance lines per phase | No bugs, no view issues | The verification standard in section 9 applies to every screen, and anything that fails it is fixed before the phase is committed. |

## 3. Repository layout

As brief section 10.1, with these additions:

```
lumen/
  apps/web/            React 18 + TS strict + Vite, CSS modules, PWA
  apps/api/            FastAPI, SQLAlchemy 2, Alembic, managed with uv
  packages/engine/     event bus, done_when evaluator, lesson runtime, simulations, interactions
  packages/lessons/    YAML lessons, Zod schema, build-time validator, compiled JSON output
  packages/design/     tokens.css, self-hosted fonts, Lumi SVG components, shared UI components
  packages/town/       town scene, one component per object, threads, concept web view
  e2e/                 Playwright tests
  docker-compose.yml   Postgres 16, Redis, api, web
  .github/workflows/ci.yml
  DECISIONS.md  BUILD_REPORT.md
```

Tooling: pnpm workspaces, Turborepo, ESLint, Prettier, Vitest, Testing Library, Playwright, Ruff, mypy, pytest. Python 3.12 is installed through `uv` because the machine only has 3.13.

## 4. Lesson engine (`packages/engine`)

The engine has no React dependency. The web app binds to it with a thin hook layer.

**Event bus.** A typed publish and subscribe bus. Events are a discriminated union (`dropped`, `settled`, `froze`, `melted`, `reacted`, `died`, `born`, `collided`, `played_note`, and others added per simulation). The bus keeps a per-step log, which `done_when` reads and which is summarised for the tutor.

**Simulation contract.** Each simulation is a class with `init(config)`, `step(dt)`, `render(ctx)`, `setParam(key, value)` and `emit(event)`, as in the brief. A shared host component owns the canvas, device-pixel-ratio scaling (capped at 2), the animation loop with `dt` capped at 50 ms, pause when the tab is hidden, and a static single frame when `prefers-reduced-motion` is set. Simulations read colours from CSS custom properties so dark mode works. Simulations are loaded lazily by kind so a lesson only downloads the simulations it uses.

**PixiJS.** Not used at launch. All twenty simulations fit Canvas 2D within the frame budget. The host accepts a renderer option so a PixiJS simulation can be added later. This is a deviation from "PixiJS for heavy scenes" only in the sense that no scene is heavy enough to need it.

**`done_when` evaluator.** A small hand-written tokenizer and recursive-descent parser. No `eval` and no `Function`. Grammar: numbers, strings, identifiers that read simulation state, the functions `count(event)`, `has(event, value)`, `event(name)` and `state(key)`, the comparisons `== != < <= > >=`, and `&& || !` with parentheses. Expressions are parsed at lesson build time, so a bad expression fails the build.

**Lesson runtime.** A state machine over the lesson's steps. It holds the current step, whether Continue is enabled, the hint level reached per step, and an attempt log. It resolves depth text with the fallback order selected depth, then Explain, then Play. Switching depth mid-step keeps interactive state and only refreshes text, as the prototype does. The hint ladder is nudge, clue (highlight), demo, then answer, and reaching the answer marks the step's concepts for spaced review. Lumi's scripted lines never contain the word "wrong".

**Interaction kit.** `predict`, `sort`, `slide` and `tap_to_explore` (tap or drop) in Phase 1. `drag`, `build` and `draw` are added in Phase 4 by the first lessons that use them. All are keyboard operable with visible focus rings and 48 px targets.

**Read-aloud.** A narration service looks for a pre-recorded audio file by line ID, then falls back to the Web Speech API. No recordings exist, so every line uses the fallback. At Play depth narration is on by default.

## 5. Lesson content (`packages/lessons`)

- One YAML file per lesson, validated by a Zod schema that is a discriminated union on step `type` (`hook`, `poke`, `predict`, `zoom`, `name_it`, `challenge`, `keep`).
- A build script validates every file, parses every `done_when`, checks that `needs`, `threads`, `object` and `where_else` point at things that exist, checks that every learner-facing string has at least a Play or Explain form, and emits one JSON module per lesson plus an index. The build fails on any error.
- The same compiled output feeds the API's `lesson` table sync and the tutor's fact sheets.
- `ice-floats.yaml` is written first and matches brief section 4.5 and the prototype line for line. The other nineteen follow its shape.
- Interface strings live in `apps/web/src/i18n/en.json`. Lesson strings live in the YAML. A second language later means a second lesson directory and a second JSON file.
- Scientific values: each lesson's `facts` list carries the value and its source. I will use standard reference values that I am confident of and mark any I could not confirm against a source in `BUILD_REPORT.md` for expert review. I will not present an unconfirmed number to learners as settled.

## 6. Web app (`apps/web`)

**Routes.** `/` landing, `/town`, `/lesson/:id`, `/signup`, `/login`, `/parent`, `/teacher`, `/ops` (section 8), `/privacy`, `/safety`. The landing page is its own entry chunk with no engine or town code, so it can meet the 200 KB JavaScript budget.

**Design system (`packages/design`).** `tokens.css` defines every colour, radius, shadow and font as a CSS custom property, with a dark set under `[data-theme="dark"]` and `prefers-color-scheme`. Fonts are self-hosted through `@fontsource` packages. Components: Button (primary and secondary pills), DepthSwitch (mist track, white thumb), Card, Chip, ProgressDots, BottomSheet, LumiStrip, and Lumi with four moods as one SVG component per mood, taken from `Lumi.dc.html`.

**Town (`packages/town`).** One SVG scene at a 1440 by 700 view box inside a horizontally scrolling frame that never renders below 880 px wide. Twenty lesson objects plus the radio dish as "coming soon", each its own component, drawn as light grey line art until done. Object state (`done`, `next`, `available`, `locked`) is derived from progress and each lesson's `needs`. At most two objects are `next`. Threads draw an animated dashed path and dim the rest. The concept web view shows the same data as a node and edge diagram with a fixed layout, and the town stays the default.

**Details the brief leaves open.**
- Subject progress in the town header counts out of 4 per subject, not the 12 in the mockup.
- The daily one-minute challenge is one predict question drawn from a finished lesson, or from the first lesson if none is finished. It is not a new simulation.
- Streaks count days with at least one finished lesson, with rest days as in the data model.

**Progress.** Local first. A versioned store in `localStorage` holds finished lessons, cards, streak and depth. When a learner is signed in, a sync queue posts attempts to the API and merges the server's view on load. The app is fully usable signed out.

**Entitlements.** One `canPlay(lesson, account)` check on the client and the same rule enforced on the API. Free covers the first lesson of each subject. Payments are not built, so a development flag grants Family.

## 7. API (`apps/api`)

**Endpoints.** Exactly the list in brief section 13, plus `GET /health`, `POST /auth/logout`, `POST /events` (first-party analytics, Phase 5) and the school endpoints in Phase 4.

**Auth.** Adult accounts only, with email and an Argon2 password hash. Sessions are opaque tokens stored in Redis and sent as an `HttpOnly`, `SameSite=Lax` cookie. Child profiles belong to a parent account and hold a nickname, an avatar and a birth-year band, and nothing else. Rate limits are Redis counters.

**Data model.** The tables in brief section 12, created by Alembic migrations. Deleting a profile cascades to attempts, mastery, cards, streak and tutor messages, and a test proves nothing is left. Export returns the same data as JSON. Tutor messages older than 90 days are removed by a purge command meant to run daily.

**Mastery.** A simple spaced-review schedule: a score from 0 to 1 per concept, raised on success and lowered when the hint ladder reaches the answer, with the next review at 1, 3, 7, 16 then 35 days.

**Weekly report.** Built from attempts and mastery with a fixed template. If a model provider is configured, the model writes the summary paragraph and that text goes through the same safety check.

**Lumi service.**

- *Provider.* A small `TutorProvider` interface with three implementations chosen by configuration: `anthropic` (the default, using the official SDK and `LUMI_MODEL`), `openai_compatible` (any service that speaks the OpenAI chat API, set by base URL, key and model), and `none`.
- *About using "the Claude you already have".* The login that runs Claude Code is not an API key, and the product cannot borrow it. The API needs its own key in `apps/api/.env`. With no key, the provider is `none`, and Lumi answers with scripted lines from the lesson file. Live model calls are therefore not verified in this run. They are covered by tests against a fake provider.
- *Safety pipeline, on every reply.* (1) Gate: under-13 profiles without `chat_unlocked` are refused free text on the server and receive suggested questions instead. (2) Input screen: length limit, personal-data patterns, and science-only scope. (3) Prompt: lesson ID, step, depth, recent engine events, hint level and the lesson's fact sheet. (4) Output check: rule-based checks for length, reading level by depth, personal-data requests and the word "wrong", then a second model call that judges on-topic, age-appropriate and consistent with the fact sheet, and returns a structured verdict. (5) On any failure, a scripted line is returned. (6) Every reply is stored in `tutor_message` with its safety result.
- *Hint ladder on the server.* `/lumi/ask` will not return an answer until two hints have been recorded for that step.

**Schools (Phase 4).** `school`, `class` and `assignment` tables, a teacher role on the adult account, class join codes so pupils join with a nickname only, a teacher dashboard with per-lesson completion and the most common wrong answers, and assignments that mark town objects as assigned.

## 8. Ops console

A staff-only console for running the product, served by the same web app at `/ops` as its own lazily loaded chunk, and backed by `/ops/*` endpoints on the same API. It uses the same design system as the rest of the product. It is desktop first and still usable at 390 px, with tables that scroll inside their own box.

**Access.** A `staff` role on the adult account, with two levels: `support` (read, plus data-rights actions) and `admin` (everything). Staff accounts cannot be created by sign-up. They are created with a command, `uv run lumen-api create-staff`. Every `/ops` endpoint checks the role on the server, staff sessions expire after 8 hours, and every staff action that reads personal data or changes anything is written to an `ops_audit_log` table (who, what, which record, when).

**Screens.**

| Screen | What it shows | Actions |
|---|---|---|
| Overview | Health of the API, Postgres, Redis and the tutor provider; counts for accounts, profiles, lessons finished today and this week; tutor replies and the share that failed the safety check | None |
| Accounts | Search by email; an account's profiles, plan, consent records and recent activity | Grant or remove a plan, unlock or lock chat for a profile, export a profile's data, delete a profile or an account (typed confirmation) |
| Lessons | Every synced lesson with version, subject, object, prerequisites and fact sheet; starts, completions, average hints used and the step where most learners stop | Re-sync lessons from the compiled files |
| Tutor log | Every tutor message with its safety result, filterable by result, lesson and date; failed replies first | Mark a message reviewed, with a note |
| Schools | Schools, classes, teachers, pupil counts and assignments | Create a school, attach a teacher account |
| Analytics | First-party events only: daily and weekly active learners, lessons by subject, the step-by-step funnel per lesson | Date range |
| System | Non-secret configuration (tutor provider and model, rate limits, retention period), feature flags, last run of the retention purge | Toggle a flag, run the purge now |
| Audit log | The staff action log | Filter by staff member, action and date |

**Privacy.** The console shows child profiles by nickname and profile ID only, because that is all that is stored. Tutor messages are visible to staff for safety review, and each view is audited. Secrets such as API keys are never returned by any endpoint, only whether they are set.

**Build order.** The console grows with the phases so each part is wired to real data when it appears: access control, audit log, Overview, Accounts, Tutor log and System in Phase 3; Lessons and Schools in Phase 4; Analytics in Phase 5.

## 9. Verification standard

I cannot promise software with zero bugs. What I can do is check every screen the same way before each phase commit, fix what the checks find, and list anything still open in `BUILD_REPORT.md`. The checks are:

- **Layout.** Playwright loads every route and every lesson step at 390, 768, 1280 and 1440 px wide and fails on horizontal page overflow, on text clipped by its container, and on interactive elements smaller than 48 px on learner screens. The town is the one deliberate horizontal scroller, inside its own frame.
- **Looking at it.** I take screenshots of every screen at phone and desktop width, in light and dark mode, and read them myself. Automated checks do not catch things that merely look off.
- **Accessibility.** `axe` runs on every route with no serious or critical violations allowed, plus keyboard-only runs of the ice lesson, the town and the console.
- **Behaviour.** Unit tests for the engine and each simulation's physics, a Playwright test that plays each lesson to its card, and pytest for every API endpoint including the permission failures.
- **Console errors.** Every Playwright test fails if the browser logs an error or an unhandled rejection.
- **Static checks.** TypeScript strict, ESLint, Ruff and mypy with no errors.

## 10. Phase plan

| Phase | Built | Proof |
|---|---|---|
| 1 | Monorepo, tooling, CI file, tokens, fonts, Lumi, engine core, `tank`, `molecules`, `lake`, the ice lesson | Unit tests for the runtime and `done_when`; Playwright plays the whole lesson at 1280 px and 390 px, by keyboard, at all three depths; a frame-time check under 4x CPU throttling |
| 2 | Town, bottom sheet, threads, Lumi strip, cards, streaks, local progress | Playwright: finishing the ice lesson paints the glass and marks the kettle next; thread toggles; horizontal scroll at 390 px |
| 3 | API, accounts, profiles, attempts, mastery, weekly report, Lumi service, sync; ops console access control, audit log, Overview, Accounts, Tutor log, System | pytest: under-13 cannot reach free text; every reply is logged with a safety result; profile deletion leaves no rows; non-staff are refused on every `/ops` endpoint; staff actions appear in the audit log |
| 4 | Nineteen simulations and lessons in round-robin subject order, landing page, schools; ops Lessons and Schools screens | Each lesson validates and has a Playwright smoke test that plays it to the card; simulation unit tests for the physics (pendulum period, lever balance, lens equation, golden angle, and so on) |
| 5 | Offline caching, performance budget script, first-party analytics, dark mode, audio and narration hooks; ops Analytics screen | Bundle-size script enforces the landing budget; offline test loads a cached lesson; dark-mode contrast check |

Lesson order in Phase 4, so no subject runs ahead: kettle, swing, scale, onion, guitar; then baking soda, seesaw, sunflower, seedling, djembe; then rusty gate, telescope, slide, bee, piano; then Moon, dice, beetles, record player.

## 11. What will be stubbed or left unverified

| Item | Why | What ships instead |
|---|---|---|
| Live AI replies | No API key | Provider code with fake-provider tests; scripted lines at runtime |
| Recorded narration | Cannot record audio | Web Speech API behind the narration service |
| Sampled piano | No licensed sample set in the repo | Tone.js synthesis behind a sampler interface that accepts samples later |
| 60 fps on a mid-range Android phone | No device | Frame-time measurement in Chrome with CPU throttling |
| CI run | No remote | Workflow file only; the same commands run locally |
| Deployment, cloud region, payments | Open decisions or later phase | Docker Compose for local use; entitlement checks; placeholders for prices |
| Curriculum mapping, other languages | Open decisions | Tags and i18n files ready |

## 12. Risks

- **Size.** Twenty simulations and twenty lessons at three depths is a large amount of content for one run. Each lesson will have the full seven-step skeleton and correct science, but the simulations will be compact, and the town art is hand-written SVG of prototype quality rather than illustrator quality.
- **Scientific accuracy.** Lesson facts come from my own knowledge of standard reference values. A subject expert should review the `facts` lists before launch. The report will list them in one place.
- **Local services.** The API tests need Postgres 16 and Redis in Docker. If Docker is not running, I will use the local Postgres 14 and Redis for the run and say so in the report.
- **Child-safety and legal claims.** The code follows the data-minimisation rules in the brief. It is not a legal compliance review for NDPA, COPPA or GDPR-K, and the report will say so.
