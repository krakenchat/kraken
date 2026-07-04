import { describe, it, expect } from 'vitest';
import { shouldResyncPush } from '../../utils/pushResync';

describe('shouldResyncPush', () => {
  it('returns false when there is no current subscription', () => {
    expect(shouldResyncPush(null, 'https://push/endpoint')).toBe(false);
    expect(shouldResyncPush(undefined, null)).toBe(false);
    expect(shouldResyncPush('', 'x')).toBe(false);
  });

  it('returns true when the endpoint has changed since last sync', () => {
    expect(shouldResyncPush('https://push/new', 'https://push/old')).toBe(true);
  });

  it('returns true when nothing has ever been synced', () => {
    expect(shouldResyncPush('https://push/new', null)).toBe(true);
    expect(shouldResyncPush('https://push/new', undefined)).toBe(true);
  });

  it('returns false when the endpoint is unchanged', () => {
    expect(shouldResyncPush('https://push/same', 'https://push/same')).toBe(false);
  });
});
