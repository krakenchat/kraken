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

describe('VoicePresenceController', () => {
  let controller: VoicePresenceController;
  let service: VoicePresenceService;

  const mockVoicePresenceService = {
    getChannelPresence: jest.fn(),
    refreshPresence: jest.fn(),
    joinVoiceChannelDirect: jest.fn(),
    leaveVoiceChannel: jest.fn(),
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
          isDeafened: false,
        },
        {
          id: 'user-2',
          username: 'user2',
          joinedAt: new Date(),
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

  describe('joinPresence', () => {
    it('should register voice presence and return success', async () => {
      const channelId = 'channel-123';

      jest.spyOn(service, 'joinVoiceChannelDirect').mockResolvedValue();

      const result = await controller.joinPresence(channelId, mockRequest);

      expect(service.joinVoiceChannelDirect).toHaveBeenCalledWith(
        channelId,
        mockUser.id,
      );
      expect(result).toEqual({
        success: true,
        message: 'Voice presence registered',
        channelId,
      });
    });
  });

  describe('leavePresence', () => {
    it('should remove voice presence and return success', async () => {
      const channelId = 'channel-123';

      jest.spyOn(service, 'leaveVoiceChannel').mockResolvedValue();

      const result = await controller.leavePresence(channelId, mockRequest);

      expect(service.leaveVoiceChannel).toHaveBeenCalledWith(
        channelId,
        mockUser.id,
      );
      expect(result).toEqual({
        success: true,
        message: 'Voice presence removed',
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
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

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
