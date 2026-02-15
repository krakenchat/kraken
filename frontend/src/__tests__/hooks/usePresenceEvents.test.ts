import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { usePresenceEvents } from '../../hooks/usePresenceEvents';
import {
  presenceControllerGetUserPresenceQueryKey,
  presenceControllerGetBulkPresenceQueryKey,
} from '../../api-client/@tanstack/react-query.gen';
import {
  createTestQueryClient,
  createMockSocket,
  createTestWrapper,
} from '../test-utils';
import type { MockSocket } from '../test-utils';

let queryClient: ReturnType<typeof createTestQueryClient>;
let mockSocket: MockSocket;

beforeEach(() => {
  queryClient = createTestQueryClient();
  mockSocket = createMockSocket();
});

function renderPresenceEvents(socket: MockSocket | null = mockSocket) {
  return renderHook(() => usePresenceEvents(), {
    wrapper: createTestWrapper({ queryClient, socket }),
  });
}

function getUserPresenceKey(userId: string) {
  return presenceControllerGetUserPresenceQueryKey({ path: { userId } });
}

function getBulkPresenceKey() {
  return presenceControllerGetBulkPresenceQueryKey();
}

describe('usePresenceEvents', () => {
  it('registers USER_ONLINE and USER_OFFLINE handlers on mount', () => {
    renderPresenceEvents();
    expect(mockSocket.on).toHaveBeenCalledWith('userOnline', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('userOffline', expect.any(Function));
  });

  it('unregisters handlers on unmount', () => {
    const { unmount } = renderPresenceEvents();
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('userOnline', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('userOffline', expect.any(Function));
  });

  it('does not register handlers when socket is null', () => {
    renderPresenceEvents(null);
    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  describe('USER_ONLINE', () => {
    it('updates single-user cache to isOnline: true', async () => {
      const userId = 'user-1';
      const queryKey = getUserPresenceKey(userId);
      queryClient.setQueryData(queryKey, { isOnline: false });

      renderPresenceEvents();

      await act(() =>
        mockSocket.simulateEvent('userOnline', { userId }),
      );

      const data = queryClient.getQueryData<{ isOnline: boolean }>(queryKey);
      expect(data!.isOnline).toBe(true);
    });

    it('updates bulk presence cache', async () => {
      const bulkKey = getBulkPresenceKey();
      queryClient.setQueryData(bulkKey, {
        presence: { 'user-1': false, 'user-2': true },
      });

      renderPresenceEvents();

      await act(() =>
        mockSocket.simulateEvent('userOnline', { userId: 'user-1' }),
      );

      const data = queryClient.getQueryData<{ presence: Record<string, boolean> }>(bulkKey);
      expect(data!.presence['user-1']).toBe(true);
      expect(data!.presence['user-2']).toBe(true);
    });

    it('invalidates multi-user presence queries', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderPresenceEvents();

      await act(() =>
        mockSocket.simulateEvent('userOnline', { userId: 'user-1' }),
      );

      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('no-op when single-user cache does not exist', async () => {
      renderPresenceEvents();

      await act(() =>
        mockSocket.simulateEvent('userOnline', { userId: 'user-no-cache' }),
      );

      const queryKey = getUserPresenceKey('user-no-cache');
      const data = queryClient.getQueryData(queryKey);
      expect(data).toBeUndefined();
    });
  });

  describe('USER_OFFLINE', () => {
    it('updates single-user cache to isOnline: false', async () => {
      const userId = 'user-1';
      const queryKey = getUserPresenceKey(userId);
      queryClient.setQueryData(queryKey, { isOnline: true });

      renderPresenceEvents();

      await act(() =>
        mockSocket.simulateEvent('userOffline', { userId }),
      );

      const data = queryClient.getQueryData<{ isOnline: boolean }>(queryKey);
      expect(data!.isOnline).toBe(false);
    });

    it('updates bulk presence cache', async () => {
      const bulkKey = getBulkPresenceKey();
      queryClient.setQueryData(bulkKey, {
        presence: { 'user-1': true, 'user-2': true },
      });

      renderPresenceEvents();

      await act(() =>
        mockSocket.simulateEvent('userOffline', { userId: 'user-1' }),
      );

      const data = queryClient.getQueryData<{ presence: Record<string, boolean> }>(bulkKey);
      expect(data!.presence['user-1']).toBe(false);
      expect(data!.presence['user-2']).toBe(true);
    });

    it('invalidates multi-user presence queries', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      renderPresenceEvents();

      await act(() =>
        mockSocket.simulateEvent('userOffline', { userId: 'user-1' }),
      );

      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('no-op when single-user cache does not exist', async () => {
      renderPresenceEvents();

      await act(() =>
        mockSocket.simulateEvent('userOffline', { userId: 'user-no-cache' }),
      );

      const queryKey = getUserPresenceKey('user-no-cache');
      const data = queryClient.getQueryData(queryKey);
      expect(data).toBeUndefined();
    });
  });
});
