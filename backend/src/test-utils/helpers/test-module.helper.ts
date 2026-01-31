/**
 * Test Module Helpers
 *
 * Utilities for creating NestJS test modules with common providers mocked.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  createMockDatabase,
  createMockRedis,
  createMockWebsocketService,
} from '../mocks';
import { DatabaseService } from '@/database/database.service';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import { WebsocketService } from '@/websocket/websocket.service';

/**
 * Create a mock JwtService
 */
export function createMockJwtService() {
  return {
    sign: jest.fn((payload: any) => 'mock-jwt-token'),
    signAsync: jest.fn((payload: any) => Promise.resolve('mock-jwt-token')),
    verify: jest.fn((token: string) => ({ userId: 'test-user-id' })),
    verifyAsync: jest.fn((token: string) =>
      Promise.resolve({ userId: 'test-user-id' }),
    ),
    decode: jest.fn((token: string) => ({ userId: 'test-user-id' })),
  };
}

/**
 * Create a mock ConfigService
 */
export function createMockConfigService(config: Record<string, any> = {}) {
  const defaultConfig = {
    JWT_SECRET: 'test-secret',
    JWT_EXPIRATION: '1h',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_REFRESH_EXPIRATION: '7d',
    LIVEKIT_API_KEY: 'test-livekit-key',
    LIVEKIT_API_SECRET: 'test-livekit-secret',
    LIVEKIT_URL: 'ws://test.livekit.io',
    ...config,
  };

  return {
    get: jest.fn((key: string) => defaultConfig[key]),
    getOrThrow: jest.fn((key: string) => {
      if (!(key in defaultConfig)) {
        throw new Error(`Configuration key "${key}" does not exist`);
      }
      return defaultConfig[key];
    }),
  };
}

/**
 * Common providers that are frequently mocked in tests
 */
export const createCommonProviders = () => [
  { provide: DatabaseService, useValue: createMockDatabase() },
  { provide: REDIS_CLIENT, useValue: createMockRedis() },
  { provide: WebsocketService, useValue: createMockWebsocketService() },
  { provide: JwtService, useValue: createMockJwtService() },
  { provide: ConfigService, useValue: createMockConfigService() },
];

/**
 * Create a test module with common providers already mocked
 */
export async function createTestModule(config: {
  providers?: any[];
  controllers?: any[];
  imports?: any[];
  exports?: any[];
}): Promise<TestingModule> {
  const {
    providers = [],
    controllers = [],
    imports = [],
    exports = [],
  } = config;

  return Test.createTestingModule({
    imports,
    controllers,
    providers: [...createCommonProviders(), ...providers],
    exports,
  }).compile();
}
