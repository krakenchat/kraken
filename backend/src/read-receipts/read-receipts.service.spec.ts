import { Test, TestingModule } from '@nestjs/testing';
import { ReadReceiptsService } from './read-receipts.service';
import { DatabaseService } from '@/database/database.service';
import { BadRequestException } from '@nestjs/common';
import {
  createMockDatabase,
  ReadReceiptFactory,
  MessageFactory,
  ChannelFactory,
  DirectMessageGroupFactory,
  MembershipFactory,
} from '@/test-utils';
import { MarkAsReadDto } from './dto/mark-as-read.dto';

describe('ReadReceiptsService', () => {
  let service: ReadReceiptsService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadReceiptsService,
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    service = module.get<ReadReceiptsService>(ReadReceiptsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('markAsRead', () => {
    const userId = 'user-123';
    const channelId = 'channel-123';
    const dmGroupId = 'dm-group-123';
    const messageId = 'message-123';

    it('should create a read receipt for a channel', async () => {
      const message = MessageFactory.build({ id: messageId, channelId });
      const readReceipt = ReadReceiptFactory.buildForChannel({
        userId,
        channelId,
        lastReadMessageId: messageId,
      });

      const dto: MarkAsReadDto = {
        lastReadMessageId: messageId,
        channelId,
      };

      mockDatabase.message.findUnique.mockResolvedValue(message);
      mockDatabase.readReceipt.upsert.mockResolvedValue(readReceipt);

      const result = await service.markAsRead(userId, dto);

      expect(result).toEqual(readReceipt);
      expect(mockDatabase.message.findUnique).toHaveBeenCalledWith({
        where: { id: messageId },
      });
      expect(mockDatabase.readReceipt.upsert).toHaveBeenCalledWith({
        where: { userId_channelId: { userId, channelId } },
        update: {
          lastReadMessageId: messageId,
          lastReadAt: expect.any(Date),
        },
        create: {
          userId,
          channelId,
          lastReadMessageId: messageId,
          lastReadAt: expect.any(Date),
        },
      });
    });

    it('should create a read receipt for a DM group', async () => {
      const message = MessageFactory.buildDirectMessage({
        id: messageId,
        directMessageGroupId: dmGroupId,
      });
      const readReceipt = ReadReceiptFactory.buildForDirectMessageGroup({
        userId,
        directMessageGroupId: dmGroupId,
        lastReadMessageId: messageId,
      });

      const dto: MarkAsReadDto = {
        lastReadMessageId: messageId,
        directMessageGroupId: dmGroupId,
      };

      mockDatabase.message.findUnique.mockResolvedValue(message);
      mockDatabase.readReceipt.upsert.mockResolvedValue(readReceipt);

      const result = await service.markAsRead(userId, dto);

      expect(result).toEqual(readReceipt);
      expect(mockDatabase.readReceipt.upsert).toHaveBeenCalledWith({
        where: {
          userId_directMessageGroupId: {
            userId,
            directMessageGroupId: dmGroupId,
          },
        },
        update: {
          lastReadMessageId: messageId,
          lastReadAt: expect.any(Date),
        },
        create: {
          userId,
          directMessageGroupId: dmGroupId,
          lastReadMessageId: messageId,
          lastReadAt: expect.any(Date),
        },
      });
    });

    it('should update existing read receipt for a channel', async () => {
      const newMessageId = 'message-456';
      const message = MessageFactory.build({ id: newMessageId, channelId });
      const updatedReceipt = ReadReceiptFactory.buildForChannel({
        userId,
        channelId,
        lastReadMessageId: newMessageId,
      });

      const dto: MarkAsReadDto = {
        lastReadMessageId: newMessageId,
        channelId,
      };

      mockDatabase.message.findUnique.mockResolvedValue(message);
      mockDatabase.readReceipt.upsert.mockResolvedValue(updatedReceipt);

      const result = await service.markAsRead(userId, dto);

      expect(result).toEqual(updatedReceipt);
      expect(mockDatabase.readReceipt.upsert).toHaveBeenCalled();
    });

    it('should throw BadRequestException when neither channelId nor directMessageGroupId is provided', async () => {
      const dto: MarkAsReadDto = {
        lastReadMessageId: messageId,
      };

      await expect(service.markAsRead(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.markAsRead(userId, dto)).rejects.toThrow(
        'Must provide exactly one of channelId or directMessageGroupId',
      );
    });

    it('should throw BadRequestException when both channelId and directMessageGroupId are provided', async () => {
      const dto: MarkAsReadDto = {
        lastReadMessageId: messageId,
        channelId,
        directMessageGroupId: dmGroupId,
      };

      await expect(service.markAsRead(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when message does not exist', async () => {
      const dto: MarkAsReadDto = {
        lastReadMessageId: messageId,
        channelId,
      };

      mockDatabase.message.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.markAsRead(userId, dto)).rejects.toThrow(
        'Message not found',
      );
    });

    it('should throw BadRequestException when message does not belong to the specified channel', async () => {
      const wrongChannelId = 'wrong-channel-123';
      const message = MessageFactory.build({
        id: messageId,
        channelId: wrongChannelId,
      });

      const dto: MarkAsReadDto = {
        lastReadMessageId: messageId,
        channelId,
      };

      mockDatabase.message.findUnique.mockResolvedValue(message);

      await expect(service.markAsRead(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.markAsRead(userId, dto)).rejects.toThrow(
        'Message does not belong to the specified channel or DM group',
      );
    });

    it('should throw BadRequestException when message does not belong to the specified DM group', async () => {
      const wrongDmGroupId = 'wrong-dm-group-123';
      const message = MessageFactory.buildDirectMessage({
        id: messageId,
        directMessageGroupId: wrongDmGroupId,
      });

      const dto: MarkAsReadDto = {
        lastReadMessageId: messageId,
        directMessageGroupId: dmGroupId,
      };

      mockDatabase.message.findUnique.mockResolvedValue(message);

      await expect(service.markAsRead(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUnreadCount', () => {
    const userId = 'user-123';
    const channelId = 'channel-123';
    const dmGroupId = 'dm-group-123';

    it('should return unread count for a channel with existing read receipt', async () => {
      const lastReadMessageId = 'message-100';
      const lastReadMessage = MessageFactory.build({
        id: lastReadMessageId,
        channelId,
        sentAt: new Date('2024-01-01'),
      });
      const readReceipt = ReadReceiptFactory.buildForChannel({
        userId,
        channelId,
        lastReadMessageId,
      });

      mockDatabase.readReceipt.findUnique.mockResolvedValue(readReceipt);
      mockDatabase.message.findUnique.mockResolvedValue(lastReadMessage);
      mockDatabase.message.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(userId, channelId);

      expect(result).toEqual({
        channelId,
        directMessageGroupId: undefined,
        unreadCount: 5,
        lastReadMessageId,
        lastReadAt: readReceipt.lastReadAt,
      });
      expect(mockDatabase.message.count).toHaveBeenCalledWith({
        where: {
          channelId,
          sentAt: { gt: lastReadMessage.sentAt },
        },
      });
    });

    it('should return unread count for a DM group with existing read receipt', async () => {
      const lastReadMessageId = 'message-200';
      const lastReadMessage = MessageFactory.buildDirectMessage({
        id: lastReadMessageId,
        directMessageGroupId: dmGroupId,
        sentAt: new Date('2024-01-01'),
      });
      const readReceipt = ReadReceiptFactory.buildForDirectMessageGroup({
        userId,
        directMessageGroupId: dmGroupId,
        lastReadMessageId,
      });

      mockDatabase.readReceipt.findUnique.mockResolvedValue(readReceipt);
      mockDatabase.message.findUnique.mockResolvedValue(lastReadMessage);
      mockDatabase.message.count.mockResolvedValue(3);

      const result = await service.getUnreadCount(userId, undefined, dmGroupId);

      expect(result).toEqual({
        channelId: undefined,
        directMessageGroupId: dmGroupId,
        unreadCount: 3,
        lastReadMessageId,
        lastReadAt: readReceipt.lastReadAt,
      });
    });

    it('should return total message count when no read receipt exists', async () => {
      mockDatabase.readReceipt.findUnique.mockResolvedValue(null);
      mockDatabase.message.count.mockResolvedValue(10);

      const result = await service.getUnreadCount(userId, channelId);

      expect(result).toEqual({
        channelId,
        directMessageGroupId: undefined,
        unreadCount: 10,
      });
      expect(mockDatabase.message.count).toHaveBeenCalledWith({
        where: { channelId },
      });
    });

    it('should return total message count when last read message was deleted', async () => {
      const lastReadMessageId = 'deleted-message';
      const readReceipt = ReadReceiptFactory.buildForChannel({
        userId,
        channelId,
        lastReadMessageId,
      });

      mockDatabase.readReceipt.findUnique.mockResolvedValue(readReceipt);
      mockDatabase.message.findUnique.mockResolvedValue(null);
      mockDatabase.message.count.mockResolvedValue(15);

      const result = await service.getUnreadCount(userId, channelId);

      expect(result).toEqual({
        channelId,
        directMessageGroupId: undefined,
        unreadCount: 15,
      });
    });

    it('should throw BadRequestException when neither channelId nor directMessageGroupId is provided', async () => {
      await expect(service.getUnreadCount(userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when both channelId and directMessageGroupId are provided', async () => {
      await expect(
        service.getUnreadCount(userId, channelId, dmGroupId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUnreadCounts', () => {
    const userId = 'user-123';

    it('should return unread counts for all channels and DM groups', async () => {
      const communityId = 'community-123';
      const channelId1 = 'channel-1';
      const channelId2 = 'channel-2';
      const dmGroupId1 = 'dm-group-1';

      const channel1 = ChannelFactory.build({ id: channelId1 });
      const channel2 = ChannelFactory.build({ id: channelId2 });
      const membership = {
        ...MembershipFactory.build({
          userId,
          communityId,
        }),
        community: {
          id: communityId,
          channels: [channel1, channel2],
        },
      } as any;
      const dmGroup = DirectMessageGroupFactory.build({ id: dmGroupId1 });

      const readReceipt1 = ReadReceiptFactory.buildForChannel({
        userId,
        channelId: channelId1,
        lastReadMessageId: 'msg-1',
      });
      const lastReadMessage1 = MessageFactory.build({
        id: 'msg-1',
        channelId: channelId1,
        sentAt: new Date('2024-01-01'),
      });

      mockDatabase.readReceipt.findMany.mockResolvedValue([readReceipt1]);
      mockDatabase.membership.findMany.mockResolvedValue([membership]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([
        { userId, groupId: dmGroupId1, group: dmGroup } as any,
      ]);
      mockDatabase.message.findMany.mockResolvedValue([lastReadMessage1]);
      mockDatabase.message.groupBy
        .mockResolvedValueOnce([
          { channelId: channelId2, _count: { channelId: 5 } },
        ])
        .mockResolvedValueOnce([
          {
            directMessageGroupId: dmGroupId1,
            _count: { directMessageGroupId: 3 },
          },
        ]);
      mockDatabase.message.count.mockResolvedValue(2);

      const result = await service.getUnreadCounts(userId);

      expect(result).toHaveLength(3);
      expect(result).toContainEqual({
        channelId: channelId2,
        unreadCount: 5,
      });
      expect(result).toContainEqual({
        directMessageGroupId: dmGroupId1,
        unreadCount: 3,
      });
      expect(mockDatabase.message.groupBy).toHaveBeenCalledTimes(2);
    });

    it('should handle channels without read receipts', async () => {
      const communityId = 'community-123';
      const channelId = 'channel-no-receipt';
      const channel = ChannelFactory.build({ id: channelId });
      const membership = {
        ...MembershipFactory.build({
          userId,
          communityId,
        }),
        community: {
          id: communityId,
          channels: [channel],
        },
      } as any;

      mockDatabase.readReceipt.findMany.mockResolvedValue([]);
      mockDatabase.membership.findMany.mockResolvedValue([membership]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([]);
      mockDatabase.message.findMany.mockResolvedValue([]);
      mockDatabase.message.groupBy
        .mockResolvedValueOnce([{ channelId, _count: { channelId: 10 } }])
        .mockResolvedValueOnce([]);

      const result = await service.getUnreadCounts(userId);

      expect(result).toContainEqual({
        channelId,
        unreadCount: 10,
      });
    });

    it('should handle DM groups without read receipts', async () => {
      const dmGroupId = 'dm-group-no-receipt';
      const dmGroup = DirectMessageGroupFactory.build({ id: dmGroupId });

      mockDatabase.readReceipt.findMany.mockResolvedValue([]);
      mockDatabase.membership.findMany.mockResolvedValue([]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([
        { userId, groupId: dmGroupId, group: dmGroup } as any,
      ]);
      mockDatabase.message.findMany.mockResolvedValue([]);
      // Since there are no channels, the first groupBy won't be called
      // Only the DM groupBy will be called
      mockDatabase.message.groupBy.mockResolvedValueOnce([
        {
          directMessageGroupId: dmGroupId,
          _count: { directMessageGroupId: 7 },
        },
      ]);

      const result = await service.getUnreadCounts(userId);

      expect(result).toContainEqual({
        directMessageGroupId: dmGroupId,
        unreadCount: 7,
      });
    });

    it('should handle deleted last read messages', async () => {
      const communityId = 'community-123';
      const channelId = 'channel-deleted-msg';
      const channel = ChannelFactory.build({ id: channelId });
      const membership = {
        ...MembershipFactory.build({
          userId,
          communityId,
        }),
        community: {
          id: communityId,
          channels: [channel],
        },
      } as any;
      const readReceipt = ReadReceiptFactory.buildForChannel({
        userId,
        channelId,
        lastReadMessageId: 'deleted-msg',
      });

      mockDatabase.readReceipt.findMany.mockResolvedValue([readReceipt]);
      mockDatabase.membership.findMany.mockResolvedValue([membership]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([]);
      mockDatabase.message.findMany.mockResolvedValue([]); // No last read message found
      mockDatabase.message.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockDatabase.message.count.mockResolvedValue(20);

      const result = await service.getUnreadCounts(userId);

      expect(result).toContainEqual({
        channelId,
        unreadCount: 20,
      });
    });

    it('should batch queries efficiently (no N+1 problem)', async () => {
      const communityId = 'community-123';
      const channelIds = ['ch-1', 'ch-2', 'ch-3'];
      const channels = channelIds.map((id) => ChannelFactory.build({ id }));
      const membership = {
        ...MembershipFactory.build({
          userId,
          communityId,
        }),
        community: {
          id: communityId,
          channels,
        },
      } as any;

      mockDatabase.readReceipt.findMany.mockResolvedValue([]);
      mockDatabase.membership.findMany.mockResolvedValue([membership]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([]);
      mockDatabase.message.findMany.mockResolvedValue([]);
      mockDatabase.message.groupBy
        .mockResolvedValueOnce(
          channelIds.map((id) => ({
            channelId: id,
            _count: { channelId: 5 },
          })),
        )
        .mockResolvedValueOnce([]);

      await service.getUnreadCounts(userId);

      // Should use groupBy for batch counting instead of individual counts
      expect(mockDatabase.message.groupBy).toHaveBeenCalledWith({
        by: ['channelId'],
        where: { channelId: { in: channelIds } },
        _count: { channelId: true },
      });
      // Should NOT call count for each channel individually
      expect(mockDatabase.message.count).not.toHaveBeenCalled();
    });
  });

  describe('getLastReadMessageId', () => {
    const userId = 'user-123';
    const channelId = 'channel-123';
    const dmGroupId = 'dm-group-123';

    it('should return last read message ID for a channel', async () => {
      const lastReadMessageId = 'message-123';
      const readReceipt = ReadReceiptFactory.buildForChannel({
        userId,
        channelId,
        lastReadMessageId,
      });

      mockDatabase.readReceipt.findUnique.mockResolvedValue(readReceipt);

      const result = await service.getLastReadMessageId(userId, channelId);

      expect(result).toBe(lastReadMessageId);
      expect(mockDatabase.readReceipt.findUnique).toHaveBeenCalledWith({
        where: { userId_channelId: { userId, channelId } },
      });
    });

    it('should return last read message ID for a DM group', async () => {
      const lastReadMessageId = 'message-456';
      const readReceipt = ReadReceiptFactory.buildForDirectMessageGroup({
        userId,
        directMessageGroupId: dmGroupId,
        lastReadMessageId,
      });

      mockDatabase.readReceipt.findUnique.mockResolvedValue(readReceipt);

      const result = await service.getLastReadMessageId(
        userId,
        undefined,
        dmGroupId,
      );

      expect(result).toBe(lastReadMessageId);
    });

    it('should return null when no read receipt exists', async () => {
      mockDatabase.readReceipt.findUnique.mockResolvedValue(null);

      const result = await service.getLastReadMessageId(userId, channelId);

      expect(result).toBeNull();
    });

    it('should throw BadRequestException when neither channelId nor directMessageGroupId is provided', async () => {
      await expect(service.getLastReadMessageId(userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when both channelId and directMessageGroupId are provided', async () => {
      await expect(
        service.getLastReadMessageId(userId, channelId, dmGroupId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
