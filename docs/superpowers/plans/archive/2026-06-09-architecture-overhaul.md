# Architecture Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 12 architecture gaps identified in the 2026-06-09 assessment: CI gates, role-hierarchy bug, env validation, distributed rate limiting, circular-dependency removal, backend E2E suite, god-service splits, supply-chain scanning, upload hardening, user-field encapsulation, frontend component tests, and observability.

**Architecture:** All work lands on branch `architecture-overhaul` as one PR with one commit per task. Backend work follows existing NestJS module patterns (no repository layer introduced). Every code change ships with unit tests per project policy. All commands run through Docker (`docker compose run --rm backend ...`) per CLAUDE.md.

**Tech Stack:** NestJS 11, Prisma 6, ioredis, @nestjs/throttler 6, class-validator, Jest + @suites/unit, supertest, Vitest + RTL + MSW (frontend), GitHub Actions, Helm.

**Execution order rationale:** Cheap CI gates first (they then protect every later task), then small high-value fixes, then the big refactors, then test suites, then observability.

---

### Task 1: Backend type check in CI

**Files:**
- Modify: `.github/workflows/backend-tests.yml`
- Modify: `backend/package.json` (add `type-check` script)

- [ ] **Step 1: Add a `type-check` script to backend/package.json**

In the `scripts` block, after `"lint"`:

```json
"type-check": "tsc --noEmit",
```

- [ ] **Step 2: Verify it works locally (and fix any pre-existing type errors it surfaces)**

Run: `docker compose run --rm backend pnpm run type-check`
Expected: exit 0. If pre-existing type errors surface, fix them minimally in this task — that's the point of the gate.

- [ ] **Step 3: Add a `typecheck` job to backend-tests.yml**

After the `lint` job, add (same setup steps as lint):

```yaml
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        working-directory: ./backend
        run: pnpm run prisma:generate

      - name: Type check
        working-directory: ./backend
        run: pnpm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/backend-tests.yml backend/package.json
git commit -m "ci: add backend TypeScript type check gate"
```

---

### Task 2: Position-based moderation role hierarchy

The bug: `backend/src/moderation/moderation.service.ts:26-32` keys hierarchy on role *names* (`Owner`, `Community Admin`, ...). No community role named `Owner` is ever created, and renaming a role silently breaks moderation. `Role.position` exists in the schema (lower number = higher rank: Community Admin=10, Moderator=20, Member=100 per `default-roles.config.ts`).

**Files:**
- Modify: `backend/src/moderation/moderation.service.ts`
- Modify: `backend/src/moderation/moderation.service.spec.ts`

- [ ] **Step 1: Read `getUserRolesForCommunity` in `backend/src/roles/roles.service.ts` and confirm returned roles include `position`. If the query selects specific fields and omits `position`, add it to the select.**

- [ ] **Step 2: Write failing tests** in `moderation.service.spec.ts`: replace any tests that mock roles by name with tests that mock roles by position. New behavior to assert:
  - User with roles at positions [20, 100] has effective rank 20 (best/lowest wins).
  - `canModerate` true when moderator best position (10) < target best position (20).
  - `canModerate` false when equal positions (20 vs 20) — strictly-lower required.
  - User with zero roles is rank `Number.MAX_SAFE_INTEGER` and can never moderate anyone, and anyone with a role can moderate them.
  - A role named anything (e.g. "Janitor") at position 10 outranks "Community Admin" renamed to position 50 — proving names are irrelevant.

- [ ] **Step 3: Run tests to verify they fail**

Run: `docker compose run --rm backend pnpm exec jest moderation.service.spec`
Expected: FAIL on the new position-based assertions.

- [ ] **Step 4: Implement.** Delete the `ROLE_HIERARCHY` constant. Replace `getUserRolePriority` with:

```typescript
/**
 * Get the user's best (lowest) role position in a community.
 * Lower position = higher rank (Community Admin = 10, Member = 100).
 * Users with no roles rank below everyone.
 */
private async getUserBestRolePosition(
  userId: string,
  communityId: string,
): Promise<number> {
  const userRoles = await this.rolesService.getUserRolesForCommunity(
    userId,
    communityId,
  );

  if (userRoles.roles.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.min(...userRoles.roles.map((role) => role.position));
}
```

And `canModerate` comparison becomes:

```typescript
const moderatorPosition = await this.getUserBestRolePosition(moderatorId, communityId);
const targetPosition = await this.getUserBestRolePosition(targetUserId, communityId);

// Lower position = higher rank; moderator must strictly outrank target.
return (
  moderatorPosition !== Number.MAX_SAFE_INTEGER &&
  moderatorPosition < targetPosition
);
```

- [ ] **Step 5: Run the moderation tests, then the full backend suite**

Run: `docker compose run --rm backend pnpm exec jest moderation` then `docker compose run --rm backend pnpm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/moderation/ backend/src/roles/
git commit -m "fix(moderation): use role position for hierarchy instead of hardcoded role names"
```

---

### Task 3: Schema-based environment validation

**Files:**
- Create: `backend/src/config/env.validation.ts`
- Create: `backend/src/config/env.validation.spec.ts`
- Modify: `backend/src/app.module.ts` (wire `validate` into `ConfigModule.forRoot`)

Uses the official NestJS class-validator pattern (no new dependency — class-validator/class-transformer already installed).

- [ ] **Step 1: Write failing tests** in `env.validation.spec.ts`:
  - Valid full config passes.
  - Missing `DATABASE_URL` throws with a message naming the variable.
  - `NODE_ENV=production` with missing `LIVEKIT_API_KEY` throws.
  - `NODE_ENV=test` with missing LiveKit vars passes (CI sets only DB/Redis/JWT).
  - Setting `VAPID_PUBLIC_KEY` without `VAPID_PRIVATE_KEY` throws (pair check).
  - Unknown extra env vars are ignored (must not whitelist-reject — process.env carries hundreds of vars).

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm backend pnpm exec jest env.validation`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `env.validation.ts`:**

```typescript
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const requiredInProduction = { groups: ['production'] };

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV?: Environment;

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty({ message: 'REDIS_HOST is required' })
  REDIS_HOST: string;

  // JWT secrets: presence is enforced here in production; weak-value
  // detection stays in main.ts validateSecrets().
  @IsString()
  @IsNotEmpty({ message: 'JWT_SECRET is required in production', ...requiredInProduction })
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_REFRESH_SECRET is required in production', ...requiredInProduction })
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsNotEmpty({ message: 'LIVEKIT_URL is required in production', ...requiredInProduction })
  LIVEKIT_URL: string;

  @IsString()
  @IsNotEmpty({ message: 'LIVEKIT_API_KEY is required in production', ...requiredInProduction })
  LIVEKIT_API_KEY: string;

  @IsString()
  @IsNotEmpty({ message: 'LIVEKIT_API_SECRET is required in production', ...requiredInProduction })
  LIVEKIT_API_SECRET: string;

  @IsOptional()
  @IsString()
  VAPID_PUBLIC_KEY?: string;

  @IsOptional()
  @IsString()
  VAPID_PRIVATE_KEY?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: false,
  });

  const isProduction = validated.NODE_ENV === Environment.Production;
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    // 'undefined' group = always-on rules; 'production' group adds prod-only rules
    groups: isProduction ? ['production'] : undefined,
    always: true,
  });

  // VAPID keys must be set together or not at all
  const hasPublic = Boolean(validated.VAPID_PUBLIC_KEY);
  const hasPrivate = Boolean(validated.VAPID_PRIVATE_KEY);
  if (hasPublic !== hasPrivate) {
    throw new Error(
      'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together (or both omitted).',
    );
  }

  if (errors.length > 0) {
    const messages = errors
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('\n  - ');
    throw new Error(`Environment validation failed:\n  - ${messages}`);
  }

  return validated;
}
```

**Implementation note:** class-validator group semantics are fiddly (decorators with `groups` only run when that group is requested; decorators *without* groups only run when *no* groups are requested). If the group approach fights back, drop groups entirely and do the production-only checks imperatively in `validateEnv` after validating the always-required fields — clarity beats cleverness here. The test list in Step 1 is the contract; the mechanism is free.

- [ ] **Step 4: Wire into app.module.ts:**

```typescript
import { validateEnv } from './config/env.validation';
// ...
ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
```

- [ ] **Step 5: Run tests**

Run: `docker compose run --rm backend pnpm exec jest env.validation` then full suite `docker compose run --rm backend pnpm run test`
Expected: PASS. Also boot the dev stack briefly (`docker compose up backend` for ~20s) to confirm the app still starts with the dev env file.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/ backend/src/app.module.ts
git commit -m "feat(config): fail-fast environment validation at startup"
```

---

### Task 4: Redis-backed HTTP rate limiting

In-memory ThrottlerGuard multiplies limits by replica count under HPA. WS throttling stays in-memory (a socket connection is pinned to one pod — per-connection state is correct there).

**Files:**
- Modify: `backend/package.json` (add `@nest-lab/throttler-storage-redis`)
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Add the dependency**

Run: `docker compose run --rm backend pnpm add @nest-lab/throttler-storage-redis`
(Verify the installed version's peer range supports @nestjs/throttler ^6 — it does as of v1.x. If pnpm flags a peer conflict, stop and check the package README for the matching major.)

- [ ] **Step 2: Wire Redis storage into the existing `ThrottlerModule.forRootAsync`** in app.module.ts. Keep the existing tier config; add `storage`:

```typescript
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
// ...
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService): ThrottlerModuleOptions => {
    const isTest = configService.get<string>('NODE_ENV') === 'test';
    const multiplier = isTest ? 100 : 1;
    return {
      throttlers: [
        { name: 'short', ttl: 1000, limit: 20 * multiplier },
        { name: 'medium', ttl: 10000, limit: 100 * multiplier },
        { name: 'long', ttl: 60000, limit: 500 * multiplier },
      ],
      // Redis-backed storage so limits hold across replicas (HPA).
      // In test mode keep the default in-memory storage.
      ...(isTest
        ? {}
        : {
            storage: new ThrottlerStorageRedisService(
              new Redis({
                host: configService.get<string>('REDIS_HOST', 'localhost'),
                port: configService.get<number>('REDIS_PORT', 6379),
                password: configService.get<string>('REDIS_PASSWORD') || undefined,
                db: configService.get<number>('REDIS_DB', 0),
              }),
            ),
          }),
    };
  },
}),
```

**Check first:** read `backend/src/redis/redis.module.ts` — if it exports an injectable ioredis client token, inject that instead of constructing a new connection (one fewer connection). If the token isn't exported/global, the dedicated connection above is acceptable; note it in the commit message.

- [ ] **Step 3: Verify boot + a manual rate-limit probe**

Run: `docker compose up -d backend` then hammer an endpoint:
`for i in $(seq 1 30); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health; done`
Expected: 429s appear after ~20 requests in 1s. Then `docker compose exec redis redis-cli keys '*throttl*'` shows throttler keys.

- [ ] **Step 4: Run full backend suite**

Run: `docker compose run --rm backend pnpm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json pnpm-lock.yaml backend/src/app.module.ts
git commit -m "feat(throttle): Redis-backed rate limiting so limits hold across replicas"
```

---

### Task 5: Break the LiveKit ↔ Messages / VoicePresence circular dependencies

Current cycle: `MessagesModule → RoomsModule → VoicePresenceModule → LivekitModule → MessagesModule`, plus `LivekitModule ↔ VoicePresenceModule`, held together by 5 `forwardRef()`s.

The Livekit→Messages edge is exactly two call sites: `livekit-replay.service.ts:1209` and `clip-library.service.ts:346`, both doing `messagesService.create(payload)` → `enrichMessageWithFileMetadata(message)` → `websocketService.sendToRoom(...)`. The HTTP response needs the created `message.id` back, so use `EventEmitter2.emitAsync` (request/response semantics, no module import).

**Files:**
- Create: `backend/src/messages/clip-message.listener.ts`
- Create: `backend/src/messages/clip-message.listener.spec.ts`
- Create: `backend/src/common/events/clip-message.events.ts` (event contract lives in a location neither module owns)
- Modify: `backend/src/livekit/livekit-replay.service.ts`, `backend/src/livekit/clip-library.service.ts`, `backend/src/livekit/livekit.module.ts`, `backend/src/messages/messages.module.ts`, `backend/src/rooms/rooms.module.ts`
- Modify: corresponding spec files

- [ ] **Step 1: Define the event contract** in `backend/src/common/events/clip-message.events.ts`:

```typescript
export const CLIP_MESSAGE_CREATE = 'clip.message.create';

/** Payload for requesting a clip message; the messages module owns creation + broadcast. */
export interface ClipMessageCreateEvent {
  authorId: string;
  fileId: string;
  durationSeconds: number;
  sizeMB: string;
  destination: 'channel' | 'dm';
  targetChannelId?: string;
  targetDirectMessageGroupId?: string;
}

export interface ClipMessageCreateResult {
  messageId: string;
}
```

(Adjust field names to exactly what the two call sites need — read both before finalizing; e.g. the message text template `Replay clip - ${duration}s (${sizeMB}MB)` moves into the listener.)

- [ ] **Step 2: Write failing listener tests** (`clip-message.listener.spec.ts`): listener builds the message payload (PLAINTEXT span with the clip text, `attachments: [fileId]`), calls `MessagesService.create`, enriches, sends `NEW_MESSAGE` to channel room or `NEW_DM` to `RoomName.dmGroup(...)`, and returns `{ messageId }`.

- [ ] **Step 3: Implement the listener** in MessagesModule:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MessagesService } from './messages.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { ServerEvents } from '@semaphore-chat/shared';
import { RoomName } from '@/common/utils/room-name.util';
import {
  CLIP_MESSAGE_CREATE,
  ClipMessageCreateEvent,
  ClipMessageCreateResult,
} from '@/common/events/clip-message.events';

@Injectable()
export class ClipMessageListener {
  private readonly logger = new Logger(ClipMessageListener.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly websocketService: WebsocketService,
  ) {}

  @OnEvent(CLIP_MESSAGE_CREATE, { promisify: true })
  async handleClipMessageCreate(
    event: ClipMessageCreateEvent,
  ): Promise<ClipMessageCreateResult> {
    // build payload exactly as livekit-replay.service.ts:1180-1206 does today
    // create → enrich → sendToRoom (NEW_MESSAGE or NEW_DM)
    // return { messageId: message.id }
  }
}
```

Register `ClipMessageListener` in MessagesModule providers.

- [ ] **Step 4: Replace both call sites** in livekit-replay.service.ts and clip-library.service.ts with:

```typescript
const [result] = (await this.eventEmitter.emitAsync(
  CLIP_MESSAGE_CREATE,
  eventPayload,
)) as ClipMessageCreateResult[];
messageId = result.messageId;
```

Remove `MessagesService` from both constructors. Remove `forwardRef(() => MessagesModule)` from livekit.module.ts. Update the two service spec files (mock `EventEmitter2.emitAsync` instead of MessagesService).

- [ ] **Step 5: Attack the Livekit ↔ VoicePresence cycle.** Investigate with `grep -rn "voicePresenceService\." backend/src/livekit/` and `grep -rn "livekitService\." backend/src/voice-presence/`. Expected shape: VoicePresence needs token generation (legitimate downward dep), Livekit needs presence cleanup on webhook/egress events (convert to fire-and-forget `eventEmitter.emit` handled in VoicePresence). If Livekit's need is request/response, use `emitAsync` like Step 3. Goal: zero `forwardRef` in livekit.module.ts, voice-presence.module.ts, rooms.module.ts. If one edge is genuinely irreducible, leave that single forwardRef and document why in a comment.

- [ ] **Step 6: Verify boot and full suite** — circular-dep failures appear at bootstrap:

Run: `docker compose up -d backend && sleep 15 && docker compose logs backend | tail -30` (expect clean start, no "Nest can't resolve dependencies"), then `docker compose run --rm backend pnpm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "refactor: dissolve LiveKit/Messages/VoicePresence circular dependencies via domain events"
```

---

### Task 6: Extract PermissionsService from RolesService

`roles.service.ts` is 1,523 lines mixing two responsibilities: RBAC *verification* (hot path, every guarded request) and role *management* (CRUD, default-role setup). Split verification out.

**Files:**
- Create: `backend/src/roles/permissions.service.ts`
- Create: `backend/src/roles/permissions.service.spec.ts`
- Modify: `backend/src/roles/roles.service.ts`, `backend/src/roles/roles.module.ts`, `backend/src/auth/rbac.guard.ts`, `backend/src/roles/roles.service.spec.ts`
- Modify: any other call sites of the moved methods (find with `grep -rn "verifyActionsForUserAndResource\|rolesService.verify" backend/src --include="*.ts" | grep -v spec`)

- [ ] **Step 1: Read roles.service.ts fully.** Identify the verification cluster: `verifyActionsForUserAndResource` and every private helper only it uses (resource resolution per RbacResourceType, channel-membership checks, instance-owner fast path). Methods used by *both* halves stay in RolesService and PermissionsService calls them via injected RolesService (one-directional dep: Permissions → Roles, never reverse).

- [ ] **Step 2: Move the verification tests.** Cut the `verifyActionsForUserAndResource` describe blocks out of `roles.service.spec.ts` (it's 80KB — this also splits the test file) into `permissions.service.spec.ts`, adjusted for the new class. Run them; expect FAIL (class missing).

- [ ] **Step 3: Create PermissionsService** (move code verbatim — this is a mechanical extraction, not a rewrite), register in RolesModule providers + exports, keep RolesService's old public method as a one-line delegate **only if** external call sites are numerous; otherwise update all call sites (RbacGuard primarily) to inject PermissionsService and delete the method from RolesService.

- [ ] **Step 4: Run full backend suite + boot check**

Run: `docker compose run --rm backend pnpm run test` and the bootstrap check from Task 5 Step 6.
Expected: PASS, clean boot.

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "refactor(roles): extract PermissionsService from RolesService (verification vs management)"
```

---

### Task 7: Split LivekitReplayService

1,659 lines covering FFmpeg orchestration, segment lifecycle + cron cleanup, egress state, and clip capture. `FfmpegService` and `ClipLibraryService` already exist — continue that decomposition.

**Files:**
- Create: `backend/src/livekit/replay-segments.service.ts` (+ spec)
- Modify: `backend/src/livekit/livekit-replay.service.ts`, `backend/src/livekit/livekit.module.ts`, `backend/src/livekit/livekit-replay.service.spec.ts`

- [ ] **Step 1: Read livekit-replay.service.ts and map method clusters.** Expected clusters: (a) segment discovery/listing/cleanup crons (`cleanupOldSegments`, `cleanupOrphanedSessions`, `cleanupRemuxCache`, segment path helpers), (b) egress lifecycle (`reconcileEgressStatus`, start/stop egress), (c) clip capture orchestration. Extract cluster (a) into `ReplaySegmentsService` — it has the fewest dependencies (filesystem + config + database) and the cron jobs move with it (`@Cron` decorators relocate cleanly).

- [ ] **Step 2: Move the corresponding tests** out of livekit-replay.service.spec.ts into replay-segments.service.spec.ts. Run; expect FAIL.

- [ ] **Step 3: Move the code verbatim**, inject ReplaySegmentsService into LivekitReplayService for any orchestration calls, register in livekit.module.ts providers.

- [ ] **Step 4: Run suite + boot check.** `docker compose run --rm backend pnpm run test` — PASS. If cluster (b) extraction also looks mechanical after (a), do it as `egress-lifecycle.service.ts` in the same pattern; if it's tangled, stop — one clean extraction beats two messy ones.

- [ ] **Step 5: Commit**

```bash
git add backend/src/livekit
git commit -m "refactor(livekit): extract ReplaySegmentsService from LivekitReplayService"
```

---

### Task 8: Backend E2E test suite

Replace the 25-line smoke test with real supertest flows against a real Postgres + Redis (CI already provisions both for unit tests).

**Files:**
- Create: `backend/test/helpers/e2e-app.ts` (boot helper: create app with same pipes/interceptors/prefix as main.ts, DB truncate between suites)
- Create: `backend/test/auth.e2e-spec.ts`
- Create: `backend/test/community-messaging.e2e-spec.ts`
- Create: `backend/test/security.e2e-spec.ts`
- Modify: `backend/test/app.e2e-spec.ts` (keep, point at `/api/health`)
- Modify: `.github/workflows/backend-tests.yml` (add `e2e` job)

- [ ] **Step 1: Investigate the registration flow first.** Read `backend/src/auth/auth.controller.ts`, `backend/src/onboarding/`, and `backend/prisma/seed-e2e.ts` (exists — used by Playwright). Determine: does registration require an instance invite? What does first-run onboarding create? Reuse seed-e2e.ts conventions for bootstrap state.

- [ ] **Step 2: Build the e2e-app helper.** It must mirror main.ts: `setGlobalPrefix('api')`, cookie-parser, global ValidationPipe `{ transform: true, whitelist: true }`, ClassSerializerInterceptor, `NODE_ENV=test` (disables throttler per app.module.ts:123). Add `resetDatabase()` that truncates all tables except `_prisma_migrations` (single `TRUNCATE ... CASCADE` raw query, fast).

- [ ] **Step 3: Write the flows** (each asserts status codes AND response shapes):
  - **auth.e2e-spec.ts**: register (or seed+login) → login returns access token + refresh cookie → refresh rotates → access protected route with token → 401 without.
  - **community-messaging.e2e-spec.ts**: login → create community (verify default roles created with positions 10/20/100) → create channel → send message → list messages (verify span content) → second user without membership gets 403 on that channel's messages (RBAC through real guard chain).
  - **security.e2e-spec.ts**: every user-bearing response in the above flows contains **no** sensitive fields — walk the JSON recursively for keys in `SENSITIVE_USER_FIELDS` (import from `@/test-utils`); assert message-create with extra unknown DTO properties strips them (whitelist works end-to-end).

- [ ] **Step 4: Run locally**

Run: `docker compose run --rm backend pnpm run test:e2e`
Expected: PASS. (DATABASE_URL inside the container points at the compose postgres; ensure the helper runs `prisma migrate deploy` or document that the dev DB is already migrated. For CI a fresh DB is migrated in the job.)

- [ ] **Step 5: Add the CI job** to backend-tests.yml (copy the `test` job's services block verbatim, then):

```yaml
      - name: Run migrations
        working-directory: ./backend
        run: pnpm run prisma:migrate
        env:
          DATABASE_URL: postgresql://semaphore:semaphore@localhost:5432/test

      - name: Run E2E tests
        working-directory: ./backend
        run: pnpm run test:e2e
        env:
          DATABASE_URL: postgresql://semaphore:semaphore@localhost:5432/test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          JWT_SECRET: test-secret-key
          JWT_REFRESH_SECRET: test-refresh-secret-key
          NODE_ENV: test
```

- [ ] **Step 6: Commit**

```bash
git add backend/test .github/workflows/backend-tests.yml
git commit -m "test(e2e): real API flow coverage — auth, community/messaging, RBAC, sensitive-field leaks"
```

---

### Task 9: Supply-chain scanning in CI

**Files:**
- Modify: `.github/workflows/docker-publish.yml` (Trivy image scan)
- Create: `.github/workflows/security-audit.yml` (dependency audit)

- [ ] **Step 1: Run `pnpm audit --prod --audit-level high` locally first** (via `docker compose run --rm backend sh -c 'cd /app && pnpm audit --prod --audit-level high'` or on the host repo root with pnpm if available — read-only, no install). Record findings. If existing high/critical vulns exist, the audit job below starts as `continue-on-error: true` with a comment; otherwise blocking.

- [ ] **Step 2: Add Trivy scan steps to both build jobs in docker-publish.yml.** After the build-push step in each job (backend shown; mirror for frontend). On PRs the image isn't pushed, so build a local-loadable single-platform image for scanning:

```yaml
      - name: Build image for scan
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./backend/Dockerfile.prod
          load: true
          push: false
          tags: scan-target-backend:latest
          cache-from: type=gha

      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: scan-target-backend:latest
          format: table
          exit-code: '1'
          severity: CRITICAL,HIGH
          ignore-unfixed: true
```

(`cache-from: type=gha` makes the scan build nearly free since the push build just primed the cache.)

- [ ] **Step 3: Create security-audit.yml:**

```yaml
name: Dependency Audit

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1' # weekly, Monday 06:00 UTC

jobs:
  audit:
    name: pnpm audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Audit production dependencies
        run: pnpm audit --prod --audit-level high
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/docker-publish.yml .github/workflows/security-audit.yml
git commit -m "ci: Trivy image scanning and pnpm dependency audit"
```

---

### Task 10: File upload hardening + nginx body-size fix

**Files:**
- Create: `backend/src/file-upload/validators/magic-bytes.util.ts` (+ spec)
- Modify: `backend/src/file-upload/validators/resource-type-file.validator.ts` (+ spec)
- Modify: `backend/src/file-upload/file-upload.service.ts` (filename sanitization — verify first)
- Modify: `frontend/nginx.conf`

- [ ] **Step 1: Check multer storage mode** (`grep -rn "memoryStorage\|diskStorage\|MulterModule" backend/src --include="*.ts" | grep -v spec`). If memory storage, `file.buffer` is available to validators; if disk, read the first 16 bytes from `file.path` with `fs.read`.

- [ ] **Step 2: Write failing tests for `magic-bytes.util.ts`:** `matchesDeclaredImageType(bytes, mimetype)` returns true for valid JPEG/PNG/GIF/WebP headers matched to their MIME, false when a renamed executable claims `image/png`, and true (pass-through) for non-image MIME types (attachments stay arbitrary).

- [ ] **Step 3: Implement:**

```typescript
const IMAGE_SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  'image/gif': (b) => b.length >= 6 && b.subarray(0, 3).toString('ascii') === 'GIF',
  'image/webp': (b) =>
    b.length >= 12 &&
    b.subarray(0, 4).toString('ascii') === 'RIFF' &&
    b.subarray(8, 12).toString('ascii') === 'WEBP',
};

/**
 * For image MIME claims, verify the file content actually starts with that
 * format's magic bytes. Non-image MIME types pass through (attachments are
 * arbitrary); unknown image/* subtypes fail closed.
 */
export function matchesDeclaredImageType(bytes: Buffer, mimetype: string): boolean {
  if (!mimetype.startsWith('image/')) return true;
  const check = IMAGE_SIGNATURES[mimetype];
  if (!check) return false;
  return check(bytes);
}
```

Wire into `ResourceTypeFileValidator.isValid` after the MIME check, and extend `buildErrorMessage` for the mismatch case.

- [ ] **Step 4: Verify filename handling in file-upload.service.ts.** If stored filenames are server-generated UUIDs (likely), no change — add a regression test asserting the stored name contains no path separators and is not the client-supplied name. If the original name is persisted for display, sanitize it: `originalName.replace(/[/\\ -]/g, '_').slice(0, 255)`.

- [ ] **Step 5: Fix nginx:** in `frontend/nginx.conf` line 80, change `client_max_body_size 100M;` → `client_max_body_size 512M;` with a comment tying it to the backend's 500MB instance default.

- [ ] **Step 6: Run tests + commit**

Run: `docker compose run --rm backend pnpm exec jest file-upload`
Expected: PASS.

```bash
git add backend/src/file-upload frontend/nginx.conf
git commit -m "feat(uploads): magic-byte validation for images, filename hardening, nginx 512M body limit"
```

---

### Task 11: PUBLIC_USER_SELECT encapsulation sweep

**Files:** discovered by sweep; plus tests.

- [ ] **Step 1: Enumerate violations:**

Run: `grep -rn "user: true\|author: true\|include: { user\|moderator: true" backend/src --include="*.ts" | grep -v spec | grep -v test-utils`

For each hit, classify: (a) result reaches a client response or WS payload → must use `select: PUBLIC_USER_SELECT` (or wrap in `new UserEntity(...)` if the full object is needed internally then serialized); (b) internal-only usage → leave, add `// internal: not serialized to clients` only if ambiguous.

- [ ] **Step 2: Fix category (a) sites.** For each fixed site, extend that module's spec with an `expectNoSensitiveUserFields()` assertion on the returned shape (helper from `@/test-utils`).

- [ ] **Step 3: Run full suite**

Run: `docker compose run --rm backend pnpm run test`
Expected: PASS. The Task 8 security e2e spec independently re-verifies the REST surface.

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "fix(security): enforce PUBLIC_USER_SELECT on all client-reachable user includes"
```

---

### Task 12: Frontend component tests for voice UI

**Files:**
- Create: `frontend/src/__tests__/components/VoiceBottomBar.test.tsx`
- Create: `frontend/src/__tests__/components/VideoTiles.test.tsx`
- Create: `frontend/src/__tests__/components/AudioVideoSettingsPanel.test.tsx`

- [ ] **Step 1: Read the three components and the existing test-utils** (`renderWithProviders`, factories, MSW handlers, and how existing voice hook tests mock LiveKit — check `frontend/src/__tests__/hooks/` for prior art on mocking `livekit-client` and VoiceContext/RoomContext providers).

- [ ] **Step 2: Write the tests.** Minimum behaviors:
  - **VoiceBottomBar**: renders connected channel name; mute button toggles (dispatch assertion); deafen toggles and implies mute state per component logic; disconnect button calls leave; screen-share button reflects `isScreenSharing`.
  - **VideoTiles**: renders one tile per participant from mocked room state; pinning a tile switches layout mode; spotlight mode renders the spotlit participant large; empty participant list renders nothing/empty state.
  - **AudioVideoSettingsPanel**: device lists render from mocked `useMediaDevices`; selecting a device persists the selection (dispatch or localStorage per implementation); empty device list shows fallback text.

  Mock at the hook boundary (`useVoiceConnection`, `useMediaDevices`, `useScreenShare`, RoomContext) — not LiveKit internals. Per CLAUDE.md: reset mock return values explicitly in `beforeEach`.

- [ ] **Step 3: Run**

Run: `docker compose run --rm frontend pnpm run test`
Expected: PASS, all suites.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/__tests__
git commit -m "test(frontend): component tests for VoiceBottomBar, VideoTiles, AudioVideoSettingsPanel"
```

---

### Task 13: Prometheus metrics + Helm ServiceMonitor

**Files:**
- Modify: `backend/package.json` (add `prom-client`, `@willsoto/nestjs-prometheus`)
- Create: `backend/src/metrics/metrics.module.ts`
- Create: `backend/src/metrics/http-metrics.interceptor.ts` (+ spec)
- Modify: `backend/src/app.module.ts`
- Create: `helm/semaphore-chat/templates/servicemonitor.yaml`
- Modify: `helm/semaphore-chat/values.yaml`

- [ ] **Step 1: Add deps:** `docker compose run --rm backend pnpm add prom-client @willsoto/nestjs-prometheus`

- [ ] **Step 2: Create MetricsModule:**

```typescript
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics', // served under global prefix → /api/metrics
      defaultMetrics: { enabled: true },
    }),
  ],
})
export class MetricsModule {}
```

The generated controller needs `@Public()` — check the library's docs for providing a custom controller; if awkward, write a 10-line custom controller injecting the registry, decorated `@Public()`. Gate exposure: if `METRICS_ENABLED !== 'true'`, don't import the module (conditional spread in app.module.ts imports, same pattern as DebugModule at app.module.ts:111).

- [ ] **Step 3: HTTP metrics interceptor** (histogram `http_request_duration_seconds` labeled by method/route/status, registered as global interceptor in MetricsModule via `APP_INTERCEPTOR`). Test: interceptor observes the histogram with the route template (not the raw URL — avoid label cardinality explosion; use `req.route?.path`).

- [ ] **Step 4: Helm ServiceMonitor** (`templates/servicemonitor.yaml`):

```yaml
{{- if .Values.metrics.serviceMonitor.enabled }}
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "semaphore-chat.fullname" . }}-backend
  labels:
    {{- include "semaphore-chat.labels" . | nindent 4 }}
spec:
  selector:
    matchLabels:
      {{- include "semaphore-chat.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: backend
  endpoints:
    - port: http
      path: /api/metrics
      interval: {{ .Values.metrics.serviceMonitor.interval | default "30s" }}
{{- end }}
```

(Verify helper template names against `helm/semaphore-chat/templates/_helpers.tpl` and the backend Service's port name + component label before finalizing.) Add to values.yaml:

```yaml
metrics:
  enabled: false
  serviceMonitor:
    enabled: false
    interval: 30s
```

And pass `METRICS_ENABLED` into the backend deployment env when `metrics.enabled`.

- [ ] **Step 5: Verify:** boot backend with `METRICS_ENABLED=true`, `curl http://localhost:3000/api/metrics` returns Prometheus text format. `helm template helm/semaphore-chat --set metrics.serviceMonitor.enabled=true` renders without error (helm binary or `docker run --rm -v $PWD/helm:/h alpine/helm template /h/semaphore-chat ...`). Run backend suite.

- [ ] **Step 6: Commit**

```bash
git add backend helm pnpm-lock.yaml
git commit -m "feat(observability): Prometheus metrics endpoint and Helm ServiceMonitor"
```

---

### Task 14: Final verification + PR

- [ ] **Step 1: Full test suites** (pre-push requirement from CLAUDE.md):

```bash
docker compose run --rm backend pnpm run test
docker compose run --rm backend pnpm run test:e2e
docker compose run --rm backend pnpm run lint
docker compose run --rm backend pnpm run type-check
docker compose run --rm frontend pnpm run test
docker compose run --rm frontend pnpm run lint
```

All must pass.

- [ ] **Step 2: Boot the full stack** (`docker compose up -d`, wait, check `docker compose logs backend | tail`) — clean start, health endpoint 200.

- [ ] **Step 3: Push and open PR** titled "Architecture overhaul: CI gates, RBAC hierarchy fix, env validation, distributed throttling, circular-dep removal, E2E suite, service splits, scanning, upload hardening, observability" with a body summarizing each task and its commit, ending with the standard Claude Code attribution.
