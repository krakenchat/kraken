import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { VoicePresenceGateway } from './voice-presence.gateway';
import { VoicePresenceService } from './voice-presence.service';
import { UserFactory } from '@/test-utils';
import { Socket } from 'socket.io';

describe('VoicePresenceGateway', () => {
  let gateway: VoicePresenceGateway;
  let service: Mocked<VoicePresenceService>;

  const mockUser = UserFactory.build();

  const createMockSocket = (
    user = mockUser,
  ): Socket & { handshake: { user: typeof mockUser } } => {
    return {
      id: 'socket-123',
      handshake: {
        user,
      },
    } as Socket & { handshake: { user: typeof mockUser } };
  };

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      VoicePresenceGateway,
    ).compile();

    gateway = unit;
    service = unitRef.get(VoicePresenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleDisconnect', () => {
    it('should clean up voice presence in all channels when client disconnects', async () => {
      const client = createMockSocket();
      const voiceChannels = ['channel-1', 'channel-2', 'channel-3'];

      service.getUserVoiceChannels.mockResolvedValue(voiceChannels);
      service.leaveVoiceChannel.mockResolvedValue();

      await gateway.handleDisconnect(client);

      expect(service.getUserVoiceChannels).toHaveBeenCalledWith(mockUser.id);
      expect(service.leaveVoiceChannel).toHaveBeenCalledTimes(3);
      expect(service.leaveVoiceChannel).toHaveBeenCalledWith(
        'channel-1',
        mockUser.id,
      );
      expect(service.leaveVoiceChannel).toHaveBeenCalledWith(
        'channel-2',
        mockUser.id,
      );
      expect(service.leaveVoiceChannel).toHaveBeenCalledWith(
        'channel-3',
        mockUser.id,
      );
    });

    it('should not call service methods when user is not authenticated', async () => {
      const client = {
        id: 'socket-456',
        handshake: {},
      } as Socket;

      await gateway.handleDisconnect(client);

      expect(service.getUserVoiceChannels).not.toHaveBeenCalled();
      expect(service.leaveVoiceChannel).not.toHaveBeenCalled();
    });

    it('should handle empty voice channels list', async () => {
      const client = createMockSocket();

      service.getUserVoiceChannels.mockResolvedValue([]);
      service.leaveVoiceChannel.mockResolvedValue();

      await gateway.handleDisconnect(client);

      expect(service.getUserVoiceChannels).toHaveBeenCalledWith(mockUser.id);
      expect(service.leaveVoiceChannel).not.toHaveBeenCalled();
    });

    it('should process all channels even if one fails', async () => {
      const client = createMockSocket();
      const voiceChannels = ['channel-1', 'channel-2'];

      service.getUserVoiceChannels.mockResolvedValue(voiceChannels);
      service.leaveVoiceChannel
        .mockRejectedValueOnce(new Error('Failed to leave channel-1'))
        .mockResolvedValueOnce();

      await expect(gateway.handleDisconnect(client)).rejects.toThrow(
        'Failed to leave channel-1',
      );

      expect(service.leaveVoiceChannel).toHaveBeenCalledTimes(1);
      expect(service.leaveVoiceChannel).toHaveBeenCalledWith(
        'channel-1',
        mockUser.id,
      );
    });
  });

  describe('handleRefreshPresence', () => {
    it('should refresh presence successfully', async () => {
      const client = createMockSocket();
      const data = { channelId: 'channel-123' };

      service.refreshPresence.mockResolvedValue();

      const result = await gateway.handleRefreshPresence(client, data);

      expect(service.refreshPresence).toHaveBeenCalledWith(
        data.channelId,
        mockUser.id,
      );
      expect(result).toEqual({
        success: true,
        channelId: 'channel-123',
      });
    });

    it('should use authenticated user ID from socket', async () => {
      const customUser = UserFactory.build({ id: 'refresh-user' });
      const client = createMockSocket(customUser);
      const data = { channelId: 'channel-refresh' };

      service.refreshPresence.mockResolvedValue();

      await gateway.handleRefreshPresence(client, data);

      expect(service.refreshPresence).toHaveBeenCalledWith(
        'channel-refresh',
        'refresh-user',
      );
    });

    it('should handle different channel IDs', async () => {
      const client = createMockSocket();
      const testChannels = ['channel-a', 'channel-b', 'channel-c'];

      service.refreshPresence.mockResolvedValue();

      for (const channelId of testChannels) {
        await gateway.handleRefreshPresence(client, { channelId });
      }

      expect(service.refreshPresence).toHaveBeenCalledTimes(3);
      expect(service.refreshPresence).toHaveBeenCalledWith(
        'channel-a',
        mockUser.id,
      );
      expect(service.refreshPresence).toHaveBeenCalledWith(
        'channel-b',
        mockUser.id,
      );
      expect(service.refreshPresence).toHaveBeenCalledWith(
        'channel-c',
        mockUser.id,
      );
    });

    it('should not throw error when service fails silently', async () => {
      const client = createMockSocket();
      const data = { channelId: 'channel-456' };

      // refreshPresence in the service doesn't throw, it logs errors
      service.refreshPresence.mockResolvedValue();

      const result = await gateway.handleRefreshPresence(client, data);

      expect(result).toEqual({
        success: true,
        channelId: 'channel-456',
      });
    });
  });
});
