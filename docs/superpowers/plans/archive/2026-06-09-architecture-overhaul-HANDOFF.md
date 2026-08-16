# Architecture Overhaul — Session Handoff (2026-06-09)

**Status: COMPLETE (2026-06-10).** All 14 tasks implemented, reviewed (spec-compliance + code-quality per task), and shipped as PR #359 (`architecture-overhaul` → `main`). See the PR description for the per-task commit map, verification results, and the follow-ups list.

**Plan:** `docs/superpowers/plans/2026-06-09-architecture-overhaul.md`

Notable extras beyond the plan, all found by the review loops:

- `4eca9fe` — refresh-token family invalidation was rolled back by its own transaction (reuse detection was dead code); found by the new e2e suite's family-invalidation assertion.
- `3e1e615` — WS handshake users carried full DB rows (incl. hashedPassword) on long-lived sockets; narrowed to public fields + ban flag.
- `cf662bc` — `@OnEvent` default error suppression would have turned clip-message create failures into opaque 500s; `suppressErrors: false` + guarded emit helper.

Environment notes that remain true for future sessions:

- ALL commands via Docker; the backend image bakes node_modules — after dependency changes run `docker compose build backend` and recreate the dev container with `--renew-anon-volumes` (stale anonymous volumes cause phantom TS errors / missing modules).
- Jest workers get OOM-killed when suites run concurrently with the dev stack: use `--maxWorkers=3` (full suite) / `--maxWorkers=2` (targeted).
- The frontend vitest suite shows rotating timeout failures under full Docker load on this WSL2 machine (different tests each run, all pass in isolation) — CI is authoritative.
- E2E runs against the dev compose DB require `-e E2E_ALLOW_DB_RESET=1` (resetDatabase refuses non-"test" database names).
