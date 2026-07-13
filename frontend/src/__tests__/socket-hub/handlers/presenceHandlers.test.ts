import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { handleUserOnline, handleUserOffline } from '../../../socket-hub/handlers/presenceHandlers';
import {
  presenceControllerGetUserPresenceQueryKey,
  presenceControllerGetBulkPresenceQueryKey,
  presenceControllerGetMultipleUserPresenceQueryKey,
} from '../../../api-client/@tanstack/react-query.gen';

describe('presenceHandlers', () => {
  describe('handleUserOnline', () => {
    it('sets isOnline to true in single-user cache', () => {
      const queryClient = new QueryClient();
      const key = presenceControllerGetUserPresenceQueryKey({ path: { userId: 'u1' } });
      queryClient.setQueryData(key, { isOnline: false });

      handleUserOnline({ userId: 'u1' }, queryClient);

      expect(queryClient.getQueryData(key)).toEqual({ isOnline: true });
    });

    it('updates bulk presence cache', () => {
      const queryClient = new QueryClient();
      const key = presenceControllerGetBulkPresenceQueryKey();
      queryClient.setQueryData(key, { presence: { u1: false, u2: true } });

      handleUserOnline({ userId: 'u1' }, queryClient);

      const data = queryClient.getQueryData<{ presence: Record<string, boolean> }>(key);
      expect(data!.presence.u1).toBe(true);
      expect(data!.presence.u2).toBe(true);
    });

    it('patches cached multi-presence queries in place without invalidating', () => {
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const key = presenceControllerGetMultipleUserPresenceQueryKey({ path: { userIds: 'u1,u2' } });
      queryClient.setQueryData(key, { presence: { u1: false, u2: true } });

      handleUserOnline({ userId: 'u1' }, queryClient);

      expect(queryClient.getQueryData(key)).toEqual({ presence: { u1: true, u2: true } });
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('leaves multi-presence queries that do not include the user untouched', () => {
      const queryClient = new QueryClient();
      const key = presenceControllerGetMultipleUserPresenceQueryKey({ path: { userIds: 'u3,u4' } });
      const original = { presence: { u3: false, u4: false } };
      queryClient.setQueryData(key, original);

      handleUserOnline({ userId: 'u1' }, queryClient);

      expect(queryClient.getQueryData(key)).toEqual(original);
    });

    it('falls back to invalidating a multi-presence query whose key cannot be parsed', () => {
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      // Simulate a cached query whose key doesn't carry a parseable `path.userIds`
      // (e.g. a future/alternate query shape) — the handler must not silently
      // skip it, it must fall back to invalidating just that query.
      const unparseableKey = [{ _id: 'presenceControllerGetMultipleUserPresence', baseUrl: 'http://x' }] as const;
      queryClient.setQueryData(unparseableKey, { presence: { u1: false } });

      handleUserOnline({ userId: 'u1' }, queryClient);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: unparseableKey, exact: true });
    });
  });

  describe('handleUserOffline', () => {
    it('sets isOnline to false in single-user cache', () => {
      const queryClient = new QueryClient();
      const key = presenceControllerGetUserPresenceQueryKey({ path: { userId: 'u1' } });
      queryClient.setQueryData(key, { isOnline: true });

      handleUserOffline({ userId: 'u1' }, queryClient);

      expect(queryClient.getQueryData(key)).toEqual({ isOnline: false });
    });

    it('patches cached multi-presence queries in place without invalidating', () => {
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const key = presenceControllerGetMultipleUserPresenceQueryKey({ path: { userIds: 'u1,u2' } });
      queryClient.setQueryData(key, { presence: { u1: true, u2: true } });

      handleUserOffline({ userId: 'u1' }, queryClient);

      expect(queryClient.getQueryData(key)).toEqual({ presence: { u1: false, u2: true } });
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('falls back to invalidating a multi-presence query whose key cannot be parsed', () => {
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const unparseableKey = [{ _id: 'presenceControllerGetMultipleUserPresence', baseUrl: 'http://x' }] as const;
      queryClient.setQueryData(unparseableKey, { presence: { u1: true } });

      handleUserOffline({ userId: 'u1' }, queryClient);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: unparseableKey, exact: true });
    });
  });
});
