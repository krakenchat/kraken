/**
 * Schema-based environment validation (structural presence check).
 *
 * Division of labour with main.ts validateSecrets():
 *   - main.ts validateSecrets(): runs FIRST, before NestFactory.create().
 *     Detects known-weak *values* (e.g. sample JWT secrets) and warns/errors
 *     accordingly. Also enforces production presence of JWT secrets directly
 *     from process.env.
 *   - THIS FILE: runs SECOND, during ConfigModule.forRoot() initialization
 *     (i.e. when Nest is already being assembled). Performs structural presence
 *     validation for the full env-var inventory and rejects partial VAPID pairs.
 */

import { plainToInstance } from 'class-transformer';
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

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV?: Environment;

  // Always required -------------------------------------------------------

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty({ message: 'REDIS_HOST is required' })
  REDIS_HOST: string;

  // Production-only (validated imperatively in validateEnv) ---------------

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_SECRET?: string;

  @IsOptional()
  @IsString()
  LIVEKIT_URL?: string;

  @IsOptional()
  @IsString()
  LIVEKIT_API_KEY?: string;

  @IsOptional()
  @IsString()
  LIVEKIT_API_SECRET?: string;

  // Optional pair ---------------------------------------------------------

  @IsOptional()
  @IsString()
  VAPID_PUBLIC_KEY?: string;

  @IsOptional()
  @IsString()
  VAPID_PRIVATE_KEY?: string;

  // Thumbnail backfill (issue #409) ---------------------------------------

  @IsOptional()
  @IsString()
  THUMBNAIL_BACKFILL_ENABLED?: string;

  @IsOptional()
  @IsString()
  THUMBNAIL_BACKFILL_BATCH_SIZE?: string;

  @IsOptional()
  @IsString()
  THUMBNAIL_BACKFILL_STARTUP_DELAY_MS?: string;

  @IsOptional()
  @IsString()
  THUMBNAIL_BACKFILL_THROTTLE_MS?: string;

  // GIF search (Tenor) — feature is disabled when absent, no production
  // requirement.
  @IsOptional()
  @IsString()
  TENOR_API_KEY?: string;

  // Optional — Password reset via email (SMTP) ----------------------------
  // The feature is auto-disabled unless SMTP_HOST, SMTP_FROM, and
  // PUBLIC_APP_URL are all set (see MailerService.isEnabled).

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsString()
  SMTP_PORT?: string;

  @IsOptional()
  @IsString()
  SMTP_SECURE?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @IsString()
  SMTP_FROM?: string;

  @IsOptional()
  @IsString()
  PUBLIC_APP_URL?: string;
}

/**
 * Variables that must be present when NODE_ENV === 'production'.
 * Checked imperatively to keep error messages simple and aggregated.
 */
const REQUIRED_IN_PRODUCTION = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
] as const;

/**
 * Validates the environment configuration object.
 *
 * Intended for use as the `validate` option in ConfigModule.forRoot().
 * Throws a single aggregated Error listing every missing/invalid variable.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    // Must stay false (the default). Flipping to true would strip every env
    // var not declared on EnvironmentVariables (CORS_ORIGIN, REPLAY_*, etc.)
    // from the object NestJS hands to ConfigService, breaking all undeclared
    // vars at runtime. validateSync ignores unknown keys on its own — no
    // whitelist option is set — so there is no need to strip them here.
    excludeExtraneousValues: false,
  });

  const errors: string[] = validateSync(validated, {
    skipMissingProperties: false,
  }).flatMap((e) => Object.values(e.constraints ?? {}));

  // Production-only presence checks (imperative — simpler than groups).
  if (validated.NODE_ENV === Environment.Production) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!config[key]) {
        errors.push(`${key} is required in production`);
      }
    }
  }

  // VAPID pair check — both or neither.
  const hasPublic = Boolean(config.VAPID_PUBLIC_KEY);
  const hasPrivate = Boolean(config.VAPID_PRIVATE_KEY);
  if (hasPublic !== hasPrivate) {
    errors.push(
      'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together (or both omitted).',
    );
  }

  // SMTP_USER / SMTP_PASS pair check — both or neither.
  const hasSmtpUser = Boolean(config.SMTP_USER);
  const hasSmtpPass = Boolean(config.SMTP_PASS);
  if (hasSmtpUser !== hasSmtpPass) {
    errors.push(
      'SMTP_USER and SMTP_PASS must be set together (or both omitted).',
    );
  }

  // SMTP_HOST requires SMTP_FROM — a from-address is mandatory to send mail.
  if (config.SMTP_HOST && !config.SMTP_FROM) {
    errors.push('SMTP_HOST requires SMTP_FROM to be set.');
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n  - ${errors.join('\n  - ')}`,
    );
  }

  return validated;
}
