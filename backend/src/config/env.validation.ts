/**
 * Schema-based environment validation (structural presence check).
 *
 * Division of labour with main.ts validateSecrets():
 *   - THIS FILE: fail-fast at startup if required env vars are absent or
 *     a partial VAPID pair is supplied. Runs inside ConfigModule.forRoot().
 *   - main.ts validateSecrets(): detects known-weak *values* (e.g. sample JWT
 *     secrets) and warns/errors accordingly. It intentionally runs after this
 *     file so it can assume the vars are structurally present.
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
    // Exclude unknown properties so validateSync doesn't surface them,
    // but we do NOT strip them — ConfigService must still be able to
    // read arbitrary process.env keys.
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

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n  - ${errors.join('\n  - ')}`,
    );
  }

  return validated;
}
