import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), dev: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  getElectronRefreshToken,
  storeElectronRefreshToken,
  clearTokens,
  setAccessToken,
  getAccessToken,
  onSecureStorageWarning,
} from '../../utils/tokenService';
import { logger } from '../../utils/logger';

describe('tokenService — Electron secure storage', () => {
  let originalElectronAPI: typeof window.electronAPI;

  beforeEach(() => {
    originalElectronAPI = window.electronAPI;
    clearTokens();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    localStorage.clear();
  });

  // ─── getElectronRefreshToken ──────────────────────────────────

  describe('getElectronRefreshToken', () => {
    it('should return token from secure storage when available', async () => {
      window.electronAPI = {
        getRefreshToken: vi.fn().mockResolvedValue('secure-token'),
      };

      const token = await getElectronRefreshToken();
      expect(token).toBe('secure-token');
      expect(window.electronAPI.getRefreshToken).toHaveBeenCalled();
    });

    it('should fall back to localStorage when secure storage returns null', async () => {
      window.electronAPI = {
        getRefreshToken: vi.fn().mockResolvedValue(null),
      };
      localStorage.setItem('refreshToken', 'legacy-token');

      const token = await getElectronRefreshToken();
      expect(token).toBe('legacy-token');
    });

    it('should fall back to localStorage when getRefreshToken is not available', async () => {
      window.electronAPI = {};
      localStorage.setItem('refreshToken', 'legacy-token');

      const token = await getElectronRefreshToken();
      expect(token).toBe('legacy-token');
    });

    it('should fall back to localStorage when electronAPI is undefined', async () => {
      window.electronAPI = undefined;
      localStorage.setItem('refreshToken', 'legacy-token');

      const token = await getElectronRefreshToken();
      expect(token).toBe('legacy-token');
    });

    it('should return null when no token exists anywhere', async () => {
      window.electronAPI = {
        getRefreshToken: vi.fn().mockResolvedValue(null),
      };

      const token = await getElectronRefreshToken();
      expect(token).toBeNull();
    });

    it('should return null when electronAPI is undefined and localStorage is empty', async () => {
      window.electronAPI = undefined;

      const token = await getElectronRefreshToken();
      expect(token).toBeNull();
    });
  });

  // ─── storeElectronRefreshToken ────────────────────────────────

  describe('storeElectronRefreshToken', () => {
    it('should store in secure storage when available', async () => {
      const mockStore = vi.fn().mockResolvedValue({ stored: true, availability: 'available' });
      window.electronAPI = {
        storeRefreshToken: mockStore,
      };

      await storeElectronRefreshToken('new-token');

      expect(mockStore).toHaveBeenCalledWith('new-token');
    });

    it('should remove localStorage entry after storing in secure storage', async () => {
      localStorage.setItem('refreshToken', 'legacy-token');
      window.electronAPI = {
        storeRefreshToken: vi.fn().mockResolvedValue({ stored: true, availability: 'available' }),
      };

      await storeElectronRefreshToken('new-token');

      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should fall back to localStorage when safeStorage is unavailable', async () => {
      window.electronAPI = {
        storeRefreshToken: vi.fn().mockResolvedValue({ stored: false, availability: 'unavailable' }),
      };

      await storeElectronRefreshToken('fallback-token');

      expect(localStorage.getItem('refreshToken')).toBe('fallback-token');
    });

    it('should fall back to localStorage when storeRefreshToken rejects', async () => {
      window.electronAPI = {
        storeRefreshToken: vi.fn().mockRejectedValue(new Error('IPC error')),
      };

      await storeElectronRefreshToken('fallback-token');

      expect(localStorage.getItem('refreshToken')).toBe('fallback-token');
    });

    it('should fall back to localStorage when storeRefreshToken is not available', async () => {
      window.electronAPI = {};

      await storeElectronRefreshToken('fallback-token');

      expect(localStorage.getItem('refreshToken')).toBe('fallback-token');
    });

    it('should fall back to localStorage when electronAPI is undefined', async () => {
      window.electronAPI = undefined;

      await storeElectronRefreshToken('fallback-token');

      expect(localStorage.getItem('refreshToken')).toBe('fallback-token');
    });
  });

  // ─── clearTokens (Electron integration) ──────────────────────

  describe('clearTokens with Electron', () => {
    it('should call deleteRefreshToken when available', () => {
      const mockDelete = vi.fn().mockResolvedValue(true);

      // Mock isElectron to return true
      window.electronAPI = {
        isElectron: true,
        deleteRefreshToken: mockDelete,
      };

      setAccessToken('some-token');
      clearTokens();

      expect(getAccessToken()).toBeNull();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should clear localStorage refreshToken even without electronAPI', () => {
      window.electronAPI = undefined;
      localStorage.setItem('refreshToken', 'rt');

      clearTokens();

      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  // ─── Secure storage warning (one-time) ────────────────────────

  describe('secure storage unavailable warning', () => {
    const WARNING_KEY = 'semaphore:secureStorageWarningShown';

    it('logs on every unavailable store, but notifies a registered listener only once', async () => {
      window.electronAPI = {
        storeRefreshToken: vi.fn().mockResolvedValue({ stored: false, availability: 'unavailable' }),
      };

      const warningListener = vi.fn();
      const unsubscribe = onSecureStorageWarning(warningListener);

      try {
        await storeElectronRefreshToken('token-1');
        await storeElectronRefreshToken('token-2');

        expect(warningListener).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledTimes(2);
        expect(localStorage.getItem(WARNING_KEY)).toBe('true');
      } finally {
        unsubscribe();
      }
    });

    it('does not notify listeners when secure storage is available', async () => {
      window.electronAPI = {
        storeRefreshToken: vi.fn().mockResolvedValue({ stored: true, availability: 'available' }),
      };

      const warningListener = vi.fn();
      const unsubscribe = onSecureStorageWarning(warningListener);

      try {
        await storeElectronRefreshToken('token');

        expect(warningListener).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(localStorage.getItem(WARNING_KEY)).toBeNull();
      } finally {
        unsubscribe();
      }
    });

    it('defers marking the warning as shown until a listener is registered', async () => {
      window.electronAPI = {
        storeRefreshToken: vi.fn().mockResolvedValue({ stored: false, availability: 'unavailable' }),
      };

      // No listener registered yet (e.g. warning fires before the
      // authenticated app shell has mounted) — must not mark as shown, so a
      // later listener can still catch it.
      await storeElectronRefreshToken('token-1');
      expect(localStorage.getItem(WARNING_KEY)).toBeNull();

      const warningListener = vi.fn();
      const unsubscribe = onSecureStorageWarning(warningListener);

      try {
        await storeElectronRefreshToken('token-2');

        expect(warningListener).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(WARNING_KEY)).toBe('true');
      } finally {
        unsubscribe();
      }
    });

    it('unsubscribe stops further notifications', async () => {
      window.electronAPI = {
        storeRefreshToken: vi.fn().mockResolvedValue({ stored: false, availability: 'unavailable' }),
      };

      const warningListener = vi.fn();
      const unsubscribe = onSecureStorageWarning(warningListener);
      unsubscribe();

      await storeElectronRefreshToken('token');

      expect(warningListener).not.toHaveBeenCalled();
    });
  });
});
