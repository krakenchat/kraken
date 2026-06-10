# Architecture Overhaul — Session Handoff (2026-06-09)

**Branch:** `architecture-overhaul` (branched from `main` at `24225aa`)
**Plan:** `docs/superpowers/plans/2026-06-09-architecture-overhaul.md` (14 tasks — read it first; it has full per-task specs)
**Process:** superpowers subagent-driven development — fresh implementer subagent per task, then spec-compliance review, then code-quality review, fix loops until approved, one commit per task (+ fix commits). Continue this process.

## Status

| Task | Status | Commits |
|------|--------|---------|
| 1. Backend type check in CI | ✅ Done, both reviews passed | `97ba10f` |
| 2. Position-based moderation hierarchy | ✅ Done, both reviews passed | `fb65a98` |
| 3. Env validation | ✅ Done, reviews + fix round | `5975c46`, `5784dba` |
| 4. Redis-backed rate limiting | ⚠️ Implemented + fail-open fix committed; **remaining verification below** | `5f58553`, fix commit on top |
| 5–14 | Not started | — |

## Task 4: Remaining verification (do this first)

Background: review of `5f58553` found a Critical — ThrottlerGuard awaits `storage.increment()` with no catch, so Redis down = every HTTP request hangs then 500s. The fix (user approved fail-open) is now committed: `backend/src/throttler/fail-open-throttler.storage.ts` wraps `ThrottlerStorageRedisService`, races increment() against a 1.5s timeout, and on error/timeout logs a warning and returns a zero-hit record (request allowed). app.module.ts now injects the shared `REDIS_CLIENT` (imports: [RedisModule]) instead of constructing its own connection.

Already verified: `jest fail-open-throttler` passes (exit 0), `pnpm run type-check` clean (exit 0).

**Still to do before marking Task 4 complete:**
1. Full backend suite: `docker compose run --rm backend pnpm run test`.
2. Boot + hammer: `docker compose up -d backend`, then 30 rapid curls to `http://localhost:3000/api/health` → expect 429s after ~20.
3. **Outage drill:** `docker compose stop redis` → curl `/api/health` returns 200 in ≤2.5s (no hang, no 500); repeat 3×; `docker compose start redis` → throttling resumes on hammer.
4. Re-run the code-quality reviewer over the fix commit (it has not been re-reviewed).

## Follow-ups noted during reviews (do NOT do now — list in the PR description)

- **Role position mutation endpoints lack hierarchy guards** (pre-existing, found in Task 2 review): `reorderRoles` (roles.service.ts:586, gated only by UPDATE_ROLE) and `assignUserToCommunityRole` (roles.service.ts:384, gated by UPDATE_MEMBER which default Moderators have) allow placing/assigning roles above the caller's own best position. Discord-style "cannot move/assign roles at or above your own position" guard recommended as follow-up.
- `NODE_ENV` is now a strict enum (development/production/test) — worth a line in deployment docs.
- Production now hard-requires LiveKit vars (per spec) — text-only prod deployments must set them.

## Environment / process notes for the next agent

- ALL commands via Docker: `docker compose run --rm backend pnpm run test` etc. Never host pnpm. (CLAUDE.md is authoritative.)
- A shell hook rewrites commands through `rtk` (token-saving proxy). Its grep/ls output is sometimes mangled — use the Read tool for files instead of shell cat/grep when output looks odd.
- `docker compose run` may need `--remove-orphans`. Redis port conflicts on rapid re-runs: stop the redis container, sleep 3, retry.
- Implementer subagents: include in their prompts the Docker rule, the rtk note, branch name, "do not push", and the commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Reviews that verify empirically (boot the stack, hammer endpoints, stop redis) have caught real bugs — keep doing that.
- Full backend suite currently: 119 suites / 2043 tests, all green as of `5784dba`. Frontend suite untouched so far.
- Task 14 (final): run all suites + lint + type-check, boot stack, push, open PR per plan. PR body should list the follow-ups above.
