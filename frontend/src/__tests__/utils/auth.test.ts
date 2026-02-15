import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), dev: vi.fn(), info: vi.fn(), debug: vi.fn() },
  default: { warn: vi.fn(), error: vi.fn(), dev: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  isAuthenticated,
  getAuthenticatedUrl,
} from '../../utils/auth';
import { logger } from '../../utils/logger';

describe('auth utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getAuthToken', () => {
    it('returns the value from JSON object format { value: "tok123" }', () => {
      localStorage.setItem('accessToken', JSON.stringify({ value: 'tok123' }));
      expect(getAuthToken()).toBe('tok123');
    });

    it('returns the value from JSON string format "tok123"', () => {
      localStorage.setItem('accessToken', JSON.stringify('tok123'));
      expect(getAuthToken()).toBe('tok123');
    });

    it('returns the value from plain string format (not valid JSON)', () => {
      localStorage.setItem('accessToken', 'tok123');
      expect(getAuthToken()).toBe('tok123');
    });

    it('returns null when no item is stored', () => {
      expect(getAuthToken()).toBeNull();
    });

    it('returns null and logs warning for JSON object without value key', () => {
      localStorage.setItem('accessToken', JSON.stringify({ foo: 'bar' }));
      expect(getAuthToken()).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected token format'),
        expect.anything(),
      );
    });
  });

  describe('setAuthToken', () => {
    it('stores token retrievable by getAuthToken', () => {
      setAuthToken('my-token');
      expect(getAuthToken()).toBe('my-token');
    });
  });

  describe('clearAuthToken', () => {
    it('removes token from localStorage', () => {
      setAuthToken('my-token');
      clearAuthToken();
      expect(getAuthToken()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when token is present', () => {
      setAuthToken('my-token');
      expect(isAuthenticated()).toBe(true);
    });

    it('returns false when token is absent', () => {
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('getAuthenticatedUrl', () => {
    it('appends ?token=<value> to the URL', () => {
      setAuthToken('my-token');
      const result = getAuthenticatedUrl('/api/file/123');
      // URL constructor with window.location.origin will produce an absolute URL
      expect(result).toContain('/api/file/123');
      expect(result).toContain('token=my-token');
    });

    it('returns original URL if token is already present in query string', () => {
      setAuthToken('my-token');
      const url = '/api/file/123?token=existing';
      const result = getAuthenticatedUrl(url);
      expect(result).toBe(url);
    });

    it('returns original URL if no token is available', () => {
      const url = '/api/file/123';
      const result = getAuthenticatedUrl(url);
      expect(result).toBe(url);
    });
  });
});
