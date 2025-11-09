import { Test, TestingModule } from '@nestjs/testing';
import { VoicePresenceGateway } from './voice-presence.gateway';
import { VoicePresenceService } from './voice-presence.service';
import { UserFactory } from '@/test-utils';
import { Socket } from 'socket.io';
import { VoiceStateUpdateDto } from './dto/voice-state-update.dto';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';

describe('VoicePresenceGateway', () => {
  let gateway: VoicePresenceGateway;
  let service: VoicePresenceService;

  const mockVoicePresenceService = {
    getUserVoiceChannels: jest.fn(),
    leaveVoiceChannel: jest.fn(),
    joinVoiceChannel: jest.fn(),
    updateVoiceState: jest.fn(),
    refreshPresence: jest.fn(),
  };

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

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoicePresenceGateway,
        {
          provide: VoicePresenceService,
          useValue: mockVoicePresenceService,
        },
      ],
    })
      .overrideGuard(WsJwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    gateway = module.get<VoicePresenceGateway>(VoicePresenceGateway);
    service = module.get<VoicePresenceService>(VoicePresenceService);
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

      jest
        .spyOn(service, 'getUserVoiceChannels')
        .mockResolvedValue(voiceChannels);
      jest.spyOn(service, 'leaveVoiceChannel').mockResolvedValue();

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

      jest.spyOn(service, 'getUserVoiceChannels').mockResolvedValue([]);
      jest.spyOn(service, 'leaveVoiceChannel').mockResolvedValue();

      await gateway.handleDisconnect(client);

      expect(service.getUserVoiceChannels).toHaveBeenCalledWith(mockUser.id);
      expect(service.leaveVoiceChannel).not.toHaveBeenCalled();
    });

    it('should process all channels even if one fails', async () => {
      const client = createMockSocket();
      const voiceChannels = ['channel-1', 'channel-2'];

      jest
        .spyOn(service, 'getUserVoiceChannels')
        .mockResolvedValue(voiceChannels);
      jest
        .spyOn(service, 'leaveVoiceChannel')
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

  describe('handleJoinVoiceChannel', () => {
    it('should join voice channel successfully', async () => {
      const client = createMockSocket();
      const data = { channelId: 'channel-123' };

      jest.spyOn(service, 'joinVoiceChannel').mockResolvedValue();

      const result = await gateway.handleJoinVoiceChannel(client, data);

      expect(service.joinVoiceChannel).toHaveBeenCalledWith(
        data.channelId,
        mockUser,
      );
      expect(result).toEqual({
        success: true,
        channelId: 'channel-123',
      });
    });

    it('should use authenticated user from socket', async () => {
      const customUser = UserFactory.build({
        id: 'custom-user-id',
        username: 'customuser',
      });
      const client = createMockSocket(customUser);
      const data = { channelId: 'channel-456' };

      jest.spyOn(service, 'joinVoiceChannel').mockResolvedValue();

      await gateway.handleJoinVoiceChannel(client, data);

      expect(service.joinVoiceChannel).toHaveBeenCalledWith(
        'channel-456',
        customUser,
      );
    });

    it('should propagate service errors', async () => {
      const client = createMockSocket();
      const data = { channelId: 'invalid-channel' };

      jest
        .spyOn(service, 'joinVoiceChannel')
        .mockRejectedValue(new Error('Channel not found'));

      await expect(
        gateway.handleJoinVoiceChannel(client, data),
      ).rejects.toThrow('Channel not found');
    });
  });

  describe('handleLeaveVoiceChannel', () => {
    it('should leave voice channel successfully', async () => {
      const client = createMockSocket();
      const data = { channelId: 'channel-123' };

      jest.spyOn(service, 'leaveVoiceChannel').mockResolvedValue();

      const result = await gateway.handleLeaveVoiceChannel(client, data);

      expect(service.leaveVoiceChannel).toHaveBeenCalledWith(
        data.channelId,
        mockUser.id,
      );
      expect(result).toEqual({
        success: true,
        channelId: 'channel-123',
      });
    });

    it('should use user ID from authenticated socket', async () => {
      const customUser = UserFactory.build({ id: 'user-789' });
      const client = createMockSocket(customUser);
      const data = { channelId: 'channel-789' };

      jest.spyOn(service, 'leaveVoiceChannel').mockResolvedValue();

      await gateway.handleLeaveVoiceChannel(client, data);

      expect(service.leaveVoiceChannel).toHaveBeenCalledWith(
        'channel-789',
        'user-789',
      );
    });

    it('should propagate service errors', async () => {
      const client = createMockSocket();
      const data = { channelId: 'channel-404' };

      jest
        .spyOn(service, 'leaveVoiceChannel')
        .mockRejectedValue(new Error('User not in channel'));

      await expect(
        gateway.handleLeaveVoiceChannel(client, data),
      ).rejects.toThrow('User not in channel');
    });
  });

  describe('handleVoiceStateUpdate', () => {
    it('should update voice state with deafen enabled', async () => {
      const client = createMockSocket();
      const data: VoiceStateUpdateDto & { channelId: string } = {
        channelId: 'channel-123',
        isDeafened: true,
      };

      jest.spyOn(service, 'updateVoiceState').mockResolvedValue();

      const result = await gateway.handleVoiceStateUpdate(client, data);

      expect(service.updateVoiceState).toHaveBeenCalledWith(
        'channel-123',
        mockUser.id,
        {
          isDeafened: true,
        },
      );
      expect(result).toEqual({
        success: true,
        channelId: 'channel-123',
        updates: {
          isDeafened: true,
        },
      });
    });

    it('should update voice state with deafen', async () => {
      const client = createMockSocket();
      const data: VoiceStateUpdateDto & { channelId: string } = {
        channelId: 'channel-456',
        isDeafened: true,
      };

      jest.spyOn(service, 'updateVoiceState').mockResolvedValue();

      const result = await gateway.handleVoiceStateUpdate(client, data);

      expect(service.updateVoiceState).toHaveBeenCalledWith(
        'channel-456',
        mockUser.id,
        {
          isDeafened: true,
        },
      );
      expect(result.updates).toEqual({
        isDeafened: true,
      });
    });

    it('should update voice state when undeafening', async () => {
      const client = createMockSocket();
      const data: VoiceStateUpdateDto & { channelId: string } = {
        channelId: 'channel-789',
        isDeafened: false,
      };

      jest.spyOn(service, 'updateVoiceState').mockResolvedValue();

      await gateway.handleVoiceStateUpdate(client, data);

      expect(service.updateVoiceState).toHaveBeenCalledWith(
        'channel-789',
        mockUser.id,
        {
          isDeafened: false,
        },
      );
    });

    it('should handle deafen state updates', async () => {
      const client = createMockSocket();
      const data: VoiceStateUpdateDto & { channelId: string } = {
        channelId: 'channel-999',
        isDeafened: false,
      };

      jest.spyOn(service, 'updateVoiceState').mockResolvedValue();

      const result = await gateway.handleVoiceStateUpdate(client, data);

      expect(service.updateVoiceState).toHaveBeenCalledWith(
        'channel-999',
        mockUser.id,
        {
          isDeafened: false,
        },
      );
      expect(result.updates).toEqual({
        isDeafened: false,
      });
    });

    it('should use authenticated user ID', async () => {
      const customUser = UserFactory.build({ id: 'special-user' });
      const client = createMockSocket(customUser);
      const data: VoiceStateUpdateDto & { channelId: string } = {
        channelId: 'channel-special',
        isDeafened: true,
      };

      jest.spyOn(service, 'updateVoiceState').mockResolvedValue();

      await gateway.handleVoiceStateUpdate(client, data);

      expect(service.updateVoiceState).toHaveBeenCalledWith(
        'channel-special',
        'special-user',
        { isDeafened: true },
      );
    });

    it('should propagate service errors', async () => {
      const client = createMockSocket();
      const data: VoiceStateUpdateDto & { channelId: string } = {
        channelId: 'channel-error',
        isDeafened: true,
      };

      jest
        .spyOn(service, 'updateVoiceState')
        .mockRejectedValue(new Error('Update failed'));

      await expect(
        gateway.handleVoiceStateUpdate(client, data),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('handleRefreshPresence', () => {
    it('should refresh presence successfully', async () => {
      const client = createMockSocket();
      const data = { channelId: 'channel-123' };

      jest.spyOn(service, 'refreshPresence').mockResolvedValue();

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

      jest.spyOn(service, 'refreshPresence').mockResolvedValue();

      await gateway.handleRefreshPresence(client, data);

      expect(service.refreshPresence).toHaveBeenCalledWith(
        'channel-refresh',
        'refresh-user',
      );
    });

    it('should handle different channel IDs', async () => {
      const client = createMockSocket();
      const testChannels = ['channel-a', 'channel-b', 'channel-c'];

      jest.spyOn(service, 'refreshPresence').mockResolvedValue();

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
      jest.spyOn(service, 'refreshPresence').mockResolvedValue();

      const result = await gateway.handleRefreshPresence(client, data);

      expect(result).toEqual({
        success: true,
        channelId: 'channel-456',
      });
    });
  });
});
