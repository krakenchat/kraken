import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

// Mock the logger to suppress dev output in tests
vi.mock('../../utils/logger', () => ({
  logger: { dev: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useVoiceEvents } from '../../hooks/useVoiceEvents';
import { voicePresenceControllerGetChannelPresenceQueryKey } from '../../api-client/@tanstack/react-query.gen';
import type { ChannelVoicePresenceResponseDto, VoicePresenceUserDto } from '../../api-client/types.gen';
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

function renderVoiceEvents(socket: MockSocket | null = mockSocket) {
  return renderHook(() => useVoiceEvents(), {
    wrapper: createTestWrapper({ queryClient, socket }),
  });
}

function createVoiceUser(overrides: Partial<VoicePresenceUserDto> = {}): VoicePresenceUserDto {
  return {
    id: 'user-1',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: undefined,
    joinedAt: new Date().toISOString(),
    isDeafened: false,
    ...overrides,
  };
}

function createPresenceData(
  channelId: string,
  users: VoicePresenceUserDto[],
): ChannelVoicePresenceResponseDto {
  return { channelId, users, count: users.length };
}

function getQueryKey(channelId: string) {
  return voicePresenceControllerGetChannelPresenceQueryKey({ path: { channelId } });
}

describe('useVoiceEvents', () => {
  it('registers all 3 voice event handlers on mount', () => {
    renderVoiceEvents();
    expect(mockSocket.on).toHaveBeenCalledWith('voiceChannelUserJoined', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('voiceChannelUserLeft', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('voiceChannelUserUpdated', expect.any(Function));
  });

  it('unregisters all 3 voice event handlers on unmount', () => {
    const { unmount } = renderVoiceEvents();
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('voiceChannelUserJoined', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('voiceChannelUserLeft', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('voiceChannelUserUpdated', expect.any(Function));
  });

  it('does not register handlers when socket is null', () => {
    renderVoiceEvents(null);
    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  describe('VOICE_CHANNEL_USER_JOINED', () => {
    it('adds user to existing cache', async () => {
      const channelId = 'channel-1';
      const existingUser = createVoiceUser({ id: 'user-existing' });
      const queryKey = getQueryKey(channelId);
      queryClient.setQueryData(queryKey, createPresenceData(channelId, [existingUser]));

      renderVoiceEvents();

      const newUser = createVoiceUser({ id: 'user-new', username: 'newuser' });
      await act(() =>
        mockSocket.simulateEvent('voiceChannelUserJoined', { channelId, user: newUser }),
      );

      const data = queryClient.getQueryData<ChannelVoicePresenceResponseDto>(queryKey);
      expect(data!.users).toHaveLength(2);
      expect(data!.count).toBe(2);
      expect(data!.users[1]).toMatchObject({ id: 'user-new' });
    });

    it('deduplicates existing user', async () => {
      const channelId = 'channel-1';
      const existingUser = createVoiceUser({ id: 'user-1' });
      const queryKey = getQueryKey(channelId);
      queryClient.setQueryData(queryKey, createPresenceData(channelId, [existingUser]));

      renderVoiceEvents();

      await act(() =>
        mockSocket.simulateEvent('voiceChannelUserJoined', {
          channelId,
          user: createVoiceUser({ id: 'user-1' }),
        }),
      );

      const data = queryClient.getQueryData<ChannelVoicePresenceResponseDto>(queryKey);
      expect(data!.users).toHaveLength(1);
    });

    it('invalidates on cache miss', async () => {
      renderVoiceEvents();

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const newUser = createVoiceUser({ id: 'user-1' });
      await act(() =>
        mockSocket.simulateEvent('voiceChannelUserJoined', {
          channelId: 'channel-no-cache',
          user: newUser,
        }),
      );

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('VOICE_CHANNEL_USER_LEFT', () => {
    it('removes user from cache', async () => {
      const channelId = 'channel-1';
      const user1 = createVoiceUser({ id: 'user-1' });
      const user2 = createVoiceUser({ id: 'user-2' });
      const queryKey = getQueryKey(channelId);
      queryClient.setQueryData(queryKey, createPresenceData(channelId, [user1, user2]));

      renderVoiceEvents();

      await act(() =>
        mockSocket.simulateEvent('voiceChannelUserLeft', { channelId, userId: 'user-1' }),
      );

      const data = queryClient.getQueryData<ChannelVoicePresenceResponseDto>(queryKey);
      expect(data!.users).toHaveLength(1);
      expect(data!.count).toBe(1);
      expect(data!.users[0]).toMatchObject({ id: 'user-2' });
    });

    it('updates count to 0 when last user leaves', async () => {
      const channelId = 'channel-1';
      const user = createVoiceUser({ id: 'user-1' });
      const queryKey = getQueryKey(channelId);
      queryClient.setQueryData(queryKey, createPresenceData(channelId, [user]));

      renderVoiceEvents();

      await act(() =>
        mockSocket.simulateEvent('voiceChannelUserLeft', { channelId, userId: 'user-1' }),
      );

      const data = queryClient.getQueryData<ChannelVoicePresenceResponseDto>(queryKey);
      expect(data!.users).toHaveLength(0);
      expect(data!.count).toBe(0);
    });

    it('invalidates on cache miss', async () => {
      renderVoiceEvents();

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      await act(() =>
        mockSocket.simulateEvent('voiceChannelUserLeft', {
          channelId: 'channel-no-cache',
          userId: 'user-1',
        }),
      );

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('VOICE_CHANNEL_USER_UPDATED', () => {
    it('updates user object in cache', async () => {
      const channelId = 'channel-1';
      const user = createVoiceUser({ id: 'user-1', isDeafened: false });
      const queryKey = getQueryKey(channelId);
      queryClient.setQueryData(queryKey, createPresenceData(channelId, [user]));

      renderVoiceEvents();

      const updatedUser = createVoiceUser({ id: 'user-1', isDeafened: true });
      await act(() =>
        mockSocket.simulateEvent('voiceChannelUserUpdated', { channelId, user: updatedUser }),
      );

      const data = queryClient.getQueryData<ChannelVoicePresenceResponseDto>(queryKey);
      expect(data!.users[0].isDeafened).toBe(true);
    });

    it('no-op if user not in list', async () => {
      const channelId = 'channel-1';
      const user = createVoiceUser({ id: 'user-1' });
      const queryKey = getQueryKey(channelId);
      queryClient.setQueryData(queryKey, createPresenceData(channelId, [user]));

      renderVoiceEvents();

      const unknownUser = createVoiceUser({ id: 'user-unknown' });
      await act(() =>
        mockSocket.simulateEvent('voiceChannelUserUpdated', { channelId, user: unknownUser }),
      );

      const data = queryClient.getQueryData<ChannelVoicePresenceResponseDto>(queryKey);
      expect(data!.users).toHaveLength(1);
      expect(data!.users[0]).toMatchObject({ id: 'user-1' });
    });

    it('invalidates on cache miss', async () => {
      renderVoiceEvents();

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const user = createVoiceUser({ id: 'user-1' });
      await act(() =>
        mockSocket.simulateEvent('voiceChannelUserUpdated', {
          channelId: 'channel-no-cache',
          user,
        }),
      );

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });
});
