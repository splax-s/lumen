# Decisions

Choices made during the build that the brief or the design spec did not fix. Newest last.

## Process

- The owner's instruction to build in one continuous run overrides the brief's "stop after each phase".
- Section 9 tokens win wherever a mockup disagrees with them (owner's answer, 2026-10-12).
- An ops console at `/ops` was added at the owner's request. It is not in the brief.
- Work happens on the branch `lumen-build`. `main` holds only the brief, references, spec and plan.

## Tooling

- TypeScript is pinned to 5.9. pnpm resolved 7.0 by default, and typescript-eslint needs the JavaScript compiler API that 5.x provides.
- Workspace packages are consumed as TypeScript source (`exports` points at `src/index.ts`). Only `@lumen/lessons` has a build step, which compiles YAML to JSON.
- Shared test tooling (Vitest, jsdom, Testing Library) is installed once at the workspace root.
- Docker was not running on the build machine, so development and tests used the local Postgres 14 and a local Redis. `docker-compose.yml` and CI target Postgres 16 and Redis 7. Nothing in the schema needs a Postgres 16 feature.
- Python 3.12 is installed through `uv`; the machine's system Python is 3.13.
- `exactOptionalPropertyTypes` is off. With CSS modules and `noUncheckedIndexedAccess` every class name is `string | undefined`, and the flag turned each `className` prop into an error without catching real bugs. `strict` and `noUncheckedIndexedAccess` stay on.
