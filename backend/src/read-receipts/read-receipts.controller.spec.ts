import { Test, TestingModule } from '@nestjs/testing';
import { ReadReceiptsController } from './read-receipts.controller';
import { ReadReceiptsService } from './read-receipts.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

describe('ReadReceiptsController', () => {
  let controller: ReadReceiptsController;

  const mockReadReceiptsService = {
    markAsRead: jest.fn(),
    getUnreadCounts: jest.fn(),
    getUnreadCount: jest.fn(),
    getLastReadMessageId: jest.fn(),
    getMessageReaders: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadReceiptsController],
      providers: [
        {
          provide: ReadReceiptsService,
          useValue: mockReadReceiptsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<ReadReceiptsController>(ReadReceiptsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMessageReaders', () => {
    const messageId = 'message-123';
    const channelId = 'channel-456';
    const userId = 'user-789';
    const mockReq = { user: { id: userId } } as any;

    it('should pass req.user.id as excludeUserId to the service', async () => {
      const mockReaders = [
        {
          userId: 'user-456',
          username: 'other',
          displayName: 'Other',
          avatarUrl: null,
          readAt: new Date(),
        },
      ];

      mockReadReceiptsService.getMessageReaders.mockResolvedValue(mockReaders);

      const result = await controller.getMessageReaders(
        mockReq,
        messageId,
        channelId,
      );

      expect(result).toEqual(mockReaders);
      expect(mockReadReceiptsService.getMessageReaders).toHaveBeenCalledWith(
        messageId,
        channelId,
        undefined,
        userId,
      );
    });

    it('should pass directMessageGroupId when provided instead of channelId', async () => {
      const directMessageGroupId = 'dm-group-123';
      const mockReaders = [
        {
          userId: 'user-456',
          username: 'other',
          displayName: 'Other',
          avatarUrl: null,
          readAt: new Date(),
        },
      ];

      mockReadReceiptsService.getMessageReaders.mockResolvedValue(mockReaders);

      const result = await controller.getMessageReaders(
        mockReq,
        messageId,
        undefined,
        directMessageGroupId,
      );

      expect(result).toEqual(mockReaders);
      expect(mockReadReceiptsService.getMessageReaders).toHaveBeenCalledWith(
        messageId,
        undefined,
        directMessageGroupId,
        userId,
      );
    });
  });
});
