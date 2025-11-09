import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';

describe('ChannelsController', () => {
  let controller: ChannelsController;
  let service: ChannelsService;

  const mockChannelsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findMentionableChannels: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [
        {
          provide: ChannelsService,
          useValue: mockChannelsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<ChannelsController>(ChannelsController);
    service = module.get<ChannelsService>(ChannelsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have a service', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a channel', async () => {
      const createDto = {
        name: 'general',
        communityId: 'community-123',
        type: 'TEXT',
      };
      const mockUser = { id: 'user-123', username: 'testuser' };
      const mockReq = { user: mockUser } as any;
      const createdChannel = { id: 'channel-123', ...createDto };

      mockChannelsService.create.mockResolvedValue(createdChannel);

      const result = await controller.create(createDto as any, mockReq);

      expect(result).toEqual(createdChannel);
      expect(mockChannelsService.create).toHaveBeenCalledWith(
        createDto,
        mockUser,
      );
    });
  });

  describe('findAllForCommunity', () => {
    it('should return all channels for a community', async () => {
      const communityId = 'community-456';
      const channels = [
        { id: 'channel-1', name: 'general' },
        { id: 'channel-2', name: 'random' },
      ];

      mockChannelsService.findAll.mockResolvedValue(channels);

      const result = await controller.findAllForCommunity(communityId);

      expect(result).toEqual(channels);
      expect(mockChannelsService.findAll).toHaveBeenCalledWith(communityId);
    });
  });

  describe('getMentionableChannels', () => {
    it('should return mentionable channels for user', async () => {
      const communityId = 'community-789';
      const mockUser = { id: 'user-456' };
      const mockReq = { user: mockUser } as any;
      const channels = [{ id: 'channel-1', name: 'general' }];

      mockChannelsService.findMentionableChannels.mockResolvedValue(channels);

      const result = await controller.getMentionableChannels(
        communityId,
        mockReq,
      );

      expect(result).toEqual(channels);
      expect(mockChannelsService.findMentionableChannels).toHaveBeenCalledWith(
        communityId,
        'user-456',
      );
    });
  });

  describe('findOne', () => {
    it('should return a single channel', async () => {
      const channelId = 'channel-999';
      const channel = { id: channelId, name: 'announcements' };

      mockChannelsService.findOne.mockResolvedValue(channel);

      const result = await controller.findOne(channelId);

      expect(result).toEqual(channel);
      expect(mockChannelsService.findOne).toHaveBeenCalledWith(channelId);
    });
  });

  describe('update', () => {
    it('should update a channel', async () => {
      const channelId = 'channel-111';
      const updateDto = { name: 'updated-channel' };
      const updatedChannel = { id: channelId, ...updateDto };

      mockChannelsService.update.mockResolvedValue(updatedChannel);

      const result = await controller.update(channelId, updateDto as any);

      expect(result).toEqual(updatedChannel);
      expect(mockChannelsService.update).toHaveBeenCalledWith(
        channelId,
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove a channel', async () => {
      const channelId = 'channel-222';

      mockChannelsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(channelId);

      expect(result).toBeUndefined();
      expect(mockChannelsService.remove).toHaveBeenCalledWith(channelId);
    });
  });
});
