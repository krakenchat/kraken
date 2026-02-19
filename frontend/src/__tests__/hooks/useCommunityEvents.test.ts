import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { useCommunityEvents } from '../../hooks/useCommunityEvents';
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

function renderCommunityEvents(socket: MockSocket | null = mockSocket) {
  return renderHook(() => useCommunityEvents(), {
    wrapper: createTestWrapper({ queryClient, socket }),
  });
}

describe('useCommunityEvents', () => {
  it('registers memberAddedToCommunity handler on mount', () => {
    renderCommunityEvents();
    expect(mockSocket.on).toHaveBeenCalledWith(
      'memberAddedToCommunity',
      expect.any(Function),
    );
  });

  it('unregisters handler on unmount', () => {
    const { unmount } = renderCommunityEvents();
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith(
      'memberAddedToCommunity',
      expect.any(Function),
    );
  });

  it('does not register handler when socket is null', () => {
    renderCommunityEvents(null);
    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it('invalidates community list query on event', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderCommunityEvents();

    await act(() =>
      mockSocket.simulateEvent('memberAddedToCommunity', {
        communityId: 'community-1',
        userId: 'user-1',
      }),
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [{ _id: 'communityControllerFindAllMine' }],
    });
  });

  it('does not emit any events back to server on event', async () => {
    renderCommunityEvents();

    await act(() =>
      mockSocket.simulateEvent('memberAddedToCommunity', {
        communityId: 'community-1',
        userId: 'user-1',
      }),
    );

    // Server handles room joining directly — no client round-trip needed
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});
