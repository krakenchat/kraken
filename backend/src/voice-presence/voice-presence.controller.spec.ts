import { Test, TestingModule } from '@nestjs/testing';
import {
  VoicePresenceController,
  DmVoicePresenceController,
  UserVoicePresenceController,
} from './voice-presence.controller';
import { VoicePresenceService } from './voice-presence.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { UserFactory } from '@/test-utils';
import { VoiceStateUpdateDto } from './dto/voice-state-update.dto';

describe('VoicePresenceController', () => {
  let controller: VoicePresenceController;
  let service: VoicePresenceService;

  const mockVoicePresenceService = {
    getChannelPresence: jest.fn(),
    joinVoiceChannel: jest.fn(),
    leaveVoiceChannel: jest.fn(),
    updateVoiceState: jest.fn(),
    refreshPresence: jest.fn(),
    getDmPresence: jest.fn(),
    joinDmVoice: jest.fn(),
    leaveDmVoice: jest.fn(),
    updateDmVoiceState: jest.fn(),
    getUserVoiceChannels: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  const mockUser = UserFactory.build();
  const mockRequest = {
    user: mockUser,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoicePresenceController],
      providers: [
        {
          provide: VoicePresenceService,
          useValue: mockVoicePresenceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<VoicePresenceController>(VoicePresenceController);
    service = module.get<VoicePresenceService>(VoicePresenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getChannelPresence', () => {
    it('should return channel presence with user count', async () => {
      const channelId = 'channel-123';
      const mockUsers = [
        {
          id: 'user-1',
          username: 'user1',
          joinedAt: new Date(),
          isVideoEnabled: false,
          isScreenSharing: false,
          isMuted: false,
          isDeafened: false,
        },
        {
          id: 'user-2',
          username: 'user2',
          joinedAt: new Date(),
          isVideoEnabled: true,
          isScreenSharing: false,
          isMuted: false,
          isDeafened: false,
        },
      ];

      jest
        .spyOn(service, 'getChannelPresence')
        .mockResolvedValue(mockUsers as any);

      const result = await controller.getChannelPresence(channelId);

      expect(service.getChannelPresence).toHaveBeenCalledWith(channelId);
      expect(result).toEqual({
        channelId,
        users: mockUsers,
        count: 2,
      });
    });

    it('should return empty array when no users in channel', async () => {
      const channelId = 'channel-456';

      jest.spyOn(service, 'getChannelPresence').mockResolvedValue([]);

      const result = await controller.getChannelPresence(channelId);

      expect(result.users).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe('joinVoiceChannel', () => {
    it('should join voice channel and return success', async () => {
      const channelId = 'channel-123';

      jest.spyOn(service, 'joinVoiceChannel').mockResolvedValue();

      const result = await controller.joinVoiceChannel(channelId, mockRequest);

      expect(service.joinVoiceChannel).toHaveBeenCalledWith(
        channelId,
        mockUser,
      );
      expect(result).toEqual({
        success: true,
        message: 'Successfully joined voice channel',
        channelId,
      });
    });

    it('should pass full user object to service', async () => {
      const channelId = 'channel-789';

      jest.spyOn(service, 'joinVoiceChannel').mockResolvedValue();

      await controller.joinVoiceChannel(channelId, mockRequest);

      const callArgs = (service.joinVoiceChannel as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toEqual(mockUser);
    });
  });

  describe('leaveVoiceChannel', () => {
    it('should leave voice channel and return success', async () => {
      const channelId = 'channel-123';

      jest.spyOn(service, 'leaveVoiceChannel').mockResolvedValue();

      const result = await controller.leaveVoiceChannel(channelId, mockRequest);

      expect(service.leaveVoiceChannel).toHaveBeenCalledWith(
        channelId,
        mockUser.id,
      );
      expect(result).toEqual({
        success: true,
        message: 'Successfully left voice channel',
        channelId,
      });
    });

    it('should use user ID from request', async () => {
      const channelId = 'channel-456';

      jest.spyOn(service, 'leaveVoiceChannel').mockResolvedValue();

      await controller.leaveVoiceChannel(channelId, mockRequest);

      expect(service.leaveVoiceChannel).toHaveBeenCalledWith(
        channelId,
        mockUser.id,
      );
    });
  });

  describe('updateVoiceState', () => {
    it('should update voice state and return success with updates', async () => {
      const channelId = 'channel-123';
      const stateUpdate: VoiceStateUpdateDto = {
        isVideoEnabled: true,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };

      jest.spyOn(service, 'updateVoiceState').mockResolvedValue();

      const result = await controller.updateVoiceState(
        channelId,
        stateUpdate,
        mockRequest,
      );

      expect(service.updateVoiceState).toHaveBeenCalledWith(
        channelId,
        mockUser.id,
        stateUpdate,
      );
      expect(result).toEqual({
        success: true,
        message: 'Voice state updated successfully',
        channelId,
        updates: stateUpdate,
      });
    });

    it('should handle mute state update', async () => {
      const channelId = 'channel-456';
      const stateUpdate: VoiceStateUpdateDto = {
        isMuted: true,
      };

      jest.spyOn(service, 'updateVoiceState').mockResolvedValue();

      const result = await controller.updateVoiceState(
        channelId,
        stateUpdate,
        mockRequest,
      );

      expect(result.updates).toEqual(stateUpdate);
    });
  });

  describe('refreshPresence', () => {
    it('should refresh presence and return success', async () => {
      const channelId = 'channel-123';

      jest.spyOn(service, 'refreshPresence').mockResolvedValue();

      const result = await controller.refreshPresence(channelId, mockRequest);

      expect(service.refreshPresence).toHaveBeenCalledWith(
        channelId,
        mockUser.id,
      );
      expect(result).toEqual({
        success: true,
        message: 'Presence refreshed successfully',
        channelId,
      });
    });
  });
});

describe('DmVoicePresenceController', () => {
  let controller: DmVoicePresenceController;
  let service: VoicePresenceService;

  const mockVoicePresenceService = {
    getDmPresence: jest.fn(),
    joinDmVoice: jest.fn(),
    leaveDmVoice: jest.fn(),
    updateDmVoiceState: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  const mockUser = UserFactory.build();
  const mockRequest = {
    user: mockUser,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DmVoicePresenceController],
      providers: [
        {
          provide: VoicePresenceService,
          useValue: mockVoicePresenceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<DmVoicePresenceController>(
      DmVoicePresenceController,
    );
    service = module.get<VoicePresenceService>(VoicePresenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDmPresence', () => {
    it('should return DM presence with user count', async () => {
      const dmGroupId = 'dm-group-123';
      const mockUsers = [
        {
          id: 'user-1',
          username: 'user1',
          joinedAt: new Date(),
          isVideoEnabled: true,
          isScreenSharing: false,
          isMuted: false,
          isDeafened: false,
        },
      ];

      jest.spyOn(service, 'getDmPresence').mockResolvedValue(mockUsers as any);

      const result = await controller.getDmPresence(dmGroupId);

      expect(service.getDmPresence).toHaveBeenCalledWith(dmGroupId);
      expect(result).toEqual({
        dmGroupId,
        users: mockUsers,
        count: 1,
      });
    });
  });

  describe('joinDmVoice', () => {
    it('should join DM voice and return success', async () => {
      const dmGroupId = 'dm-group-123';

      jest.spyOn(service, 'joinDmVoice').mockResolvedValue();

      const result = await controller.joinDmVoice(dmGroupId, mockRequest);

      expect(service.joinDmVoice).toHaveBeenCalledWith(dmGroupId, mockUser);
      expect(result).toEqual({
        success: true,
        message: 'Successfully joined DM voice call',
        dmGroupId,
      });
    });
  });

  describe('leaveDmVoice', () => {
    it('should leave DM voice and return success', async () => {
      const dmGroupId = 'dm-group-123';

      jest.spyOn(service, 'leaveDmVoice').mockResolvedValue();

      const result = await controller.leaveDmVoice(dmGroupId, mockRequest);

      expect(service.leaveDmVoice).toHaveBeenCalledWith(dmGroupId, mockUser.id);
      expect(result).toEqual({
        success: true,
        message: 'Successfully left DM voice call',
        dmGroupId,
      });
    });
  });

  describe('updateDmVoiceState', () => {
    it('should update DM voice state and return success', async () => {
      const dmGroupId = 'dm-group-123';
      const stateUpdate: VoiceStateUpdateDto = {
        isScreenSharing: true,
        isVideoEnabled: true,
      };

      jest.spyOn(service, 'updateDmVoiceState').mockResolvedValue();

      const result = await controller.updateDmVoiceState(
        dmGroupId,
        stateUpdate,
        mockRequest,
      );

      expect(service.updateDmVoiceState).toHaveBeenCalledWith(
        dmGroupId,
        mockUser.id,
        stateUpdate,
      );
      expect(result).toEqual({
        success: true,
        message: 'DM voice state updated successfully',
        dmGroupId,
        updates: stateUpdate,
      });
    });
  });
});

describe('UserVoicePresenceController', () => {
  let controller: UserVoicePresenceController;
  let service: VoicePresenceService;

  const mockVoicePresenceService = {
    getUserVoiceChannels: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  const mockUser = UserFactory.build();
  const mockRequest = {
    user: mockUser,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserVoicePresenceController],
      providers: [
        {
          provide: VoicePresenceService,
          useValue: mockVoicePresenceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<UserVoicePresenceController>(
      UserVoicePresenceController,
    );
    service = module.get<VoicePresenceService>(VoicePresenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyVoiceChannels', () => {
    it('should return user voice channels', async () => {
      const mockChannels = ['channel-1', 'channel-2'];

      jest
        .spyOn(service, 'getUserVoiceChannels')
        .mockResolvedValue(mockChannels);

      const result = await controller.getMyVoiceChannels(mockRequest);

      expect(service.getUserVoiceChannels).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        userId: mockUser.id,
        voiceChannels: mockChannels,
      });
    });

    it('should return empty array when user is not in any voice channels', async () => {
      jest.spyOn(service, 'getUserVoiceChannels').mockResolvedValue([]);

      const result = await controller.getMyVoiceChannels(mockRequest);

      expect(result.voiceChannels).toEqual([]);
    });
  });
});
