/**
 * Jest setupFiles hook for the e2e suite.
 *
 * Must run BEFORE any test file imports AppModule: app.module.ts decides at
 * *import time* whether to register the global ThrottlerGuard (it is skipped
 * when NODE_ENV === 'test'), and the dev Docker container exports
 * NODE_ENV=development, which Jest does not override when already set.
 */
process.env.NODE_ENV = 'test';

export {};
