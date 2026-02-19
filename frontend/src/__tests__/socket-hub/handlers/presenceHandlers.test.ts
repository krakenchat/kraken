import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { handleUserOnline, handleUserOffline } from '../../../socket-hub/handlers/presenceHandlers';
import {
  presenceControllerGetUserPresenceQueryKey,
  presenceControllerGetBulkPresenceQueryKey,
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
  });

  describe('handleUserOffline', () => {
    it('sets isOnline to false in single-user cache', () => {
      const queryClient = new QueryClient();
      const key = presenceControllerGetUserPresenceQueryKey({ path: { userId: 'u1' } });
      queryClient.setQueryData(key, { isOnline: true });

      handleUserOffline({ userId: 'u1' }, queryClient);

      expect(queryClient.getQueryData(key)).toEqual({ isOnline: false });
    });
  });
});
