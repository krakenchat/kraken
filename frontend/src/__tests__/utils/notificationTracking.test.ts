import { describe, it, expect, beforeEach } from 'vitest';
import {
  isPermissionRequested,
  setPermissionRequested,
  isNotificationShown,
  markNotificationAsShown,
} from '../../utils/notificationTracking';

describe('notificationTracking', () => {
  // The module uses module-scoped state, so we need to reset between tests
  beforeEach(() => {
    setPermissionRequested(false);
  });

  describe('permissionRequested', () => {
    it('defaults to false', () => {
      expect(isPermissionRequested()).toBe(false);
    });

    it('returns true after being set to true', () => {
      setPermissionRequested(true);
      expect(isPermissionRequested()).toBe(true);
    });

    it('can be toggled back to false', () => {
      setPermissionRequested(true);
      setPermissionRequested(false);
      expect(isPermissionRequested()).toBe(false);
    });
  });

  describe('notificationShown', () => {
    it('returns false for an ID that has never been marked', () => {
      expect(isNotificationShown('never-seen')).toBe(false);
    });

    it('returns true after marking an ID as shown', () => {
      markNotificationAsShown('notif-1');
      expect(isNotificationShown('notif-1')).toBe(true);
    });

    it('marking the same ID twice is a no-op (idempotent)', () => {
      markNotificationAsShown('notif-2');
      markNotificationAsShown('notif-2');
      expect(isNotificationShown('notif-2')).toBe(true);
    });

    it('tracks multiple IDs independently', () => {
      markNotificationAsShown('a');
      markNotificationAsShown('b');
      expect(isNotificationShown('a')).toBe(true);
      expect(isNotificationShown('b')).toBe(true);
      expect(isNotificationShown('c')).toBe(false);
    });
  });
});
