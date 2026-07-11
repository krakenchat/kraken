import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './msw/server';

// RTL's default findBy*/waitFor timeout (1000ms) assumes a lightly-loaded
// machine. Under v8 coverage instrumentation + constrained CI parallelism,
// real timers (debounce, MSW round-trips) can occasionally take longer to
// fire even though nothing is actually stuck — bumping this gives assertions
// realistic headroom instead of trading it for a global vitest testTimeout
// bump alone.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
