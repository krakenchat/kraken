import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCachedItem, setCachedItem, removeCachedItem } from '../../utils/storage';

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('setCachedItem / getCachedItem roundtrip', () => {
    it('stores and retrieves a string value', () => {
      setCachedItem('key1', 'hello');
      expect(getCachedItem<string>('key1')).toBe('hello');
    });

    it('stores and retrieves an object value', () => {
      const obj = { name: 'test', count: 42 };
      setCachedItem('key2', obj);
      expect(getCachedItem<typeof obj>('key2')).toEqual(obj);
    });

    it('stores non-TTL items as plain JSON', () => {
      setCachedItem('key3', 'plain');
      const raw = localStorage.getItem('key3');
      expect(raw).toBe('"plain"');
    });
  });

  describe('TTL behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns the value before TTL expires', () => {
      setCachedItem('ttl-key', 'value', 5000);
      vi.advanceTimersByTime(3000);
      expect(getCachedItem<string>('ttl-key')).toBe('value');
    });

    it('returns null after TTL expires', () => {
      setCachedItem('ttl-key', 'value', 5000);
      vi.advanceTimersByTime(6000);
      expect(getCachedItem<string>('ttl-key')).toBeNull();
    });
  });

  describe('removeCachedItem', () => {
    it('removes the key so getCachedItem returns null', () => {
      setCachedItem('rm-key', 'value');
      removeCachedItem('rm-key');
      expect(getCachedItem<string>('rm-key')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for invalid JSON in localStorage', () => {
      localStorage.setItem('bad-json', '{not valid json!!!');
      expect(getCachedItem('bad-json')).toBeNull();
    });

    it('returns null for missing key', () => {
      expect(getCachedItem('nonexistent')).toBeNull();
    });
  });
});
