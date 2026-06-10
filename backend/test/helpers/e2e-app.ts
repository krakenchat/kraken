/**
 * E2E application boot helper.
 *
 * Boots the full AppModule with the same global prefix / pipes / interceptors
 * as src/main.ts, so e2e specs exercise the exact request pipeline production
 * uses: global JwtAuthGuard, RBAC guard chain, ValidationPipe whitelist and
 * ClassSerializerInterceptor (helmet/CORS/Swagger/WS-adapter are omitted —
 * they don't affect route behavior under supertest).
 *
 * NODE_ENV is forced to 'test' in helpers/setup-env.ts (jest setupFiles)
 * before AppModule is imported; this disables the ThrottlerGuard per
 * app.module.ts.
 */
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { Response } from 'supertest';
import { AppModule } from '@/app.module';
import { DatabaseService } from '@/database/database.service';

export type E2eApp = INestApplication<App>;

/** Instance invite code seeded for registration in e2e flows. */
export const E2E_INVITE_CODE = 'e2e-test-invite';

export async function createE2eApp(): Promise<E2eApp> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: E2eApp = moduleFixture.createNestApplication({
    // Keep test output readable — Nest boot logs are noisy.
    logger: false,
  });

  // Mirror src/main.ts request pipeline.
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.init();
  return app;
}

/**
 * Truncate every table in the public schema except _prisma_migrations.
 * Single TRUNCATE ... CASCADE statement — fast, and resets identity columns.
 *
 * NOTE: destructive by design. The e2e suite owns whatever database
 * DATABASE_URL points at (CI provisions a dedicated `test` database).
 */
export async function resetDatabase(app: E2eApp): Promise<void> {
  const db = app.get(DatabaseService);
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const tableList = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Create an open instance invite so POST /api/users registration works
 * (registration always requires a valid instance invite code).
 * Mirrors prisma/seed-e2e.ts conventions.
 */
export async function seedInstanceInvite(
  app: E2eApp,
  code: string = E2E_INVITE_CODE,
): Promise<string> {
  const db = app.get(DatabaseService);
  await db.instanceInvite.create({
    data: {
      code,
      maxUses: null, // unlimited
      validUntil: null, // never expires
      disabled: false,
    },
  });
  return code;
}

export interface RegisteredUser {
  id: string;
  username: string;
  role: string;
}

/**
 * Register a user through the real public endpoint.
 * The FIRST user registered after resetDatabase() becomes InstanceRole.OWNER
 * (user.service.ts: userCount === 0 → OWNER), subsequent users are USER.
 */
export async function registerUser(
  app: E2eApp,
  creds: { username: string; password: string; email?: string },
  code: string = E2E_INVITE_CODE,
): Promise<RegisteredUser> {
  const res = await request(app.getHttpServer())
    .post('/api/users')
    .send({ code, ...creds })
    .expect(201);
  return res.body as RegisteredUser;
}

export interface LoginResult {
  accessToken: string;
  /** Full `refresh_token=...` cookie pair (name=value), ready for a Cookie header. */
  refreshCookie: string;
  /** Raw Set-Cookie headers from the login response. */
  setCookies: string[];
}

export function getSetCookies(res: Response): string[] {
  const raw = res.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Extract the `name=value` pair for a cookie from Set-Cookie headers. */
export function extractCookie(
  setCookies: string[],
  name: string,
): string | undefined {
  const header = setCookies.find((c) => c.startsWith(`${name}=`));
  return header?.split(';')[0];
}

export async function loginUser(
  app: E2eApp,
  username: string,
  password: string,
): Promise<LoginResult> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username, password })
    .expect(200);

  const setCookies = getSetCookies(res);
  const refreshCookie = extractCookie(setCookies, 'refresh_token');
  const body = res.body as { accessToken: string };

  if (!body.accessToken || !refreshCookie) {
    throw new Error(
      'Login did not return an access token and refresh cookie as expected',
    );
  }

  return { accessToken: body.accessToken, refreshCookie, setCookies };
}
