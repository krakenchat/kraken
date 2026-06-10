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
| 4. Redis-backed rate limiting | ⚠️ Committed but **fix required before proceeding** (see below) | `5f58553` |
| 5–14 | Not started | — |

## Task 4: REQUIRED FIX (do this first)

Commit `5f58553` works (verified: 20×200 then 10×429 hammering `/api/health`, full suite green) but code review found a **Critical**: ThrottlerGuard awaits `storage.increment()` with no catch, so with Redis down every HTTP request hangs ~8s (ioredis offline queue) then 500s — a Redis blip is now a full API outage. Reviewer empirically confirmed by stopping Redis. Two Important issues: (a) the factory builds a dedicated ioredis connection that is never closed; (b) its justifying comment ("circular module deps") is false — `ThrottlerModule.forRootAsync` accepts `imports: [RedisModule]` + `inject: [ConfigService, REDIS_CLIENT]` with zero circularity.

**Agreed fix (user approved fail-open):**
1. New `backend/src/throttler/fail-open-throttler.storage.ts`: class `FailOpenThrottlerStorage implements ThrottlerStorage` wrapping `ThrottlerStorageRedisService`; `increment(...)` races the inner call against a ~1500ms timeout; on any rejection/timeout, log a warning and return `{ totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }` (= request allowed). Verify the exact `ThrottlerStorage`/`ThrottlerStorageRecord` types against installed @nestjs/throttler 6.x in node_modules. Guard against unhandled rejection from the loser of the race.
2. Spec file with: success delegation, inner-rejection fail-open + warning, timeout fail-open (small constructor-injected timeout for the test).
3. app.module.ts: `imports: [RedisModule]`, `inject: [ConfigService, REDIS_CLIENT]` (read `backend/src/redis/redis.module.ts` for the token), `storage: new FailOpenThrottlerStorage(new ThrottlerStorageRedisService(redis))` in non-test mode only; delete the dedicated `new Redis(...)` and the false comment. Check RedisModule's client doesn't eagerly connect in ways that break tests (jest never bootstraps AppModule — verified — so this mainly affects boot/e2e).
4. Verify: jest fail-open spec, full suite, type-check, boot + hammer (429s), **outage drill** (`docker compose stop redis` → curl `/api/health` returns 200 in ≤2.5s, no hang; `docker compose start redis` → throttling resumes).
5. Commit: `fix(throttle): fail open on Redis outage and reuse shared Redis client`.

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
