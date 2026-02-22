import { TestBed } from '@suites/unit';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { DatabaseService } from '@/database/database.service';
import { createMockDatabase, MessageFactory, FileFactory } from '@/test-utils';

describe('ThreadsService', () => {
  let service: ThreadsService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const { unit } = await TestBed.solitary(ThreadsService)
      .mock(DatabaseService)
      .final(mockDatabase)
      .compile();

    service = unit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getParentMessage', () => {
    it('should return parent message when found', async () => {
      const parent = MessageFactory.build({ parentMessageId: null });
      mockDatabase.message.findUnique.mockResolvedValue(parent);

      const result = await service.getParentMessage(parent.id);

      expect(result).toEqual(parent);
      expect(mockDatabase.message.findUnique).toHaveBeenCalledWith({
        where: { id: parent.id },
      });
    });

    it('should throw NotFoundException when parent not found', async () => {
      mockDatabase.message.findUnique.mockResolvedValue(null);

      await expect(service.getParentMessage('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for nested threads', async () => {
      const reply = MessageFactory.build({ parentMessageId: 'some-parent-id' });
      mockDatabase.message.findUnique.mockResolvedValue(reply);

      await expect(service.getParentMessage(reply.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createThreadReply', () => {
    const authorId = 'author-123';
    const parentMessageId = 'parent-msg-123';
    const channelId = 'channel-456';

    const dto = {
      parentMessageId,
      spans: [{ type: 'PLAINTEXT' as any, text: 'Hello thread' }],
      attachments: [],
      pendingAttachments: 0,
    };

    it('should create a thread reply in a channel context', async () => {
      const parent = MessageFactory.build({
        id: parentMessageId,
        channelId,
        directMessageGroupId: null,
        parentMessageId: null,
      });
      const reply = MessageFactory.build({
        authorId,
        channelId,
        parentMessageId,
      });

      mockDatabase.message.findUnique.mockResolvedValue(parent);
      mockDatabase.message.create.mockResolvedValue(reply);
      mockDatabase.message.update.mockResolvedValue(parent);
      mockDatabase.threadSubscriber.upsert.mockResolvedValue({});

      const result = await service.createThreadReply(dto, authorId);

      expect(result).toEqual(reply);
      expect(mockDatabase.$transaction).toHaveBeenCalled();
      expect(mockDatabase.message.create).toHaveBeenCalled();
      expect(mockDatabase.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: parentMessageId },
          data: expect.objectContaining({
            replyCount: { increment: 1 },
          }),
        }),
      );
    });

    it('should create a thread reply in a DM context', async () => {
      const dmGroupId = 'dm-group-123';
      const parent = MessageFactory.build({
        id: parentMessageId,
        channelId: null,
        directMessageGroupId: dmGroupId,
        parentMessageId: null,
      });
      const reply = MessageFactory.build({
        authorId,
        directMessageGroupId: dmGroupId,
        parentMessageId,
      });

      mockDatabase.message.findUnique.mockResolvedValue(parent);
      mockDatabase.message.create.mockResolvedValue(reply);
      mockDatabase.message.update.mockResolvedValue(parent);
      mockDatabase.threadSubscriber.upsert.mockResolvedValue({});

      const result = await service.createThreadReply(
        { ...dto, parentMessageId },
        authorId,
      );

      expect(result).toEqual(reply);
    });

    it('should auto-subscribe the replier to the thread', async () => {
      const parent = MessageFactory.build({
        id: parentMessageId,
        channelId,
        directMessageGroupId: null,
        parentMessageId: null,
      });
      const reply = MessageFactory.build({ authorId, parentMessageId });

      mockDatabase.message.findUnique.mockResolvedValue(parent);
      mockDatabase.message.create.mockResolvedValue(reply);
      mockDatabase.message.update.mockResolvedValue(parent);
      mockDatabase.threadSubscriber.upsert.mockResolvedValue({});

      await service.createThreadReply(dto, authorId);

      expect(mockDatabase.threadSubscriber.upsert).toHaveBeenCalledWith({
        where: {
          userId_parentMessageId: { userId: authorId, parentMessageId },
        },
        create: { userId: authorId, parentMessageId },
        update: {},
      });
    });

    it('should sanitize spans to only include valid fields', async () => {
      const parent = MessageFactory.build({
        id: parentMessageId,
        channelId,
        directMessageGroupId: null,
        parentMessageId: null,
      });
      const reply = MessageFactory.build({ authorId, parentMessageId });

      const dtoWithExtraFields = {
        parentMessageId,
        spans: [
          {
            type: 'PLAINTEXT' as any,
            text: 'Hello',
            extraField: 'should be stripped',
          },
        ],
      };

      mockDatabase.message.findUnique.mockResolvedValue(parent);
      mockDatabase.message.create.mockResolvedValue(reply);
      mockDatabase.message.update.mockResolvedValue(parent);
      mockDatabase.threadSubscriber.upsert.mockResolvedValue({});

      await service.createThreadReply(dtoWithExtraFields as any, authorId);

      const createCall = mockDatabase.message.create.mock.calls[0][0];
      const spans = createCall.data.spans;
      expect(spans[0]).not.toHaveProperty('extraField');
      expect(spans[0]).toEqual({
        type: 'PLAINTEXT',
        text: 'Hello',
        userId: null,
        specialKind: null,
        communityId: null,
        aliasId: null,
      });
    });

    it('should throw when parent message is itself a thread reply', async () => {
      const nestedParent = MessageFactory.build({
        id: parentMessageId,
        parentMessageId: 'grandparent-id',
      });
      mockDatabase.message.findUnique.mockResolvedValue(nestedParent);

      await expect(
        service.createThreadReply(dto, authorId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getThreadReplies', () => {
    const parentMessageId = 'parent-msg-123';

    it('should return paginated replies', async () => {
      const replies = MessageFactory.buildMany(3, { parentMessageId });
      mockDatabase.message.findUnique.mockResolvedValue({ id: parentMessageId });
      mockDatabase.message.findMany.mockResolvedValue(replies);

      const result = await service.getThreadReplies(parentMessageId, 50);

      expect(result.replies).toEqual(replies);
      expect(result.continuationToken).toBeUndefined();
    });

    it('should return continuation token when results equal limit', async () => {
      const replies = MessageFactory.buildMany(2, { parentMessageId });
      mockDatabase.message.findUnique.mockResolvedValue({ id: parentMessageId });
      mockDatabase.message.findMany.mockResolvedValue(replies);

      const result = await service.getThreadReplies(parentMessageId, 2);

      expect(result.continuationToken).toBe(replies[1].id);
    });

    it('should use cursor when continuation token provided', async () => {
      const token = 'cursor-id-123';
      mockDatabase.message.findUnique.mockResolvedValue({ id: parentMessageId });
      mockDatabase.message.findMany.mockResolvedValue([]);

      await service.getThreadReplies(parentMessageId, 50, token);

      expect(mockDatabase.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: token },
          skip: 1,
        }),
      );
    });

    it('should throw NotFoundException when parent not found', async () => {
      mockDatabase.message.findUnique.mockResolvedValue(null);

      await expect(
        service.getThreadReplies('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getThreadRepliesWithMetadata', () => {
    const parentMessageId = 'parent-msg-123';

    it('should enrich replies with file metadata', async () => {
      const fileId = 'file-123';
      const reply = MessageFactory.build({
        parentMessageId,
        attachments: [fileId],
      });
      const file = FileFactory.build({
        id: fileId,
        filename: 'test.png',
        mimeType: 'image/png',
        fileType: 'IMAGE',
        size: 1024,
        thumbnailPath: '/thumbnails/test.png',
      });

      mockDatabase.message.findUnique.mockResolvedValue({ id: parentMessageId });
      mockDatabase.message.findMany.mockResolvedValue([reply]);
      mockDatabase.file.findMany.mockResolvedValue([file]);

      const result = await service.getThreadRepliesWithMetadata(parentMessageId);

      expect(result.replies).toHaveLength(1);
      expect(result.replies[0].attachments).toEqual([
        expect.objectContaining({
          id: fileId,
          filename: 'test.png',
          hasThumbnail: true,
        }),
      ]);
    });

    it('should convert thumbnailPath to hasThumbnail boolean', async () => {
      const fileId = 'file-123';
      const reply = MessageFactory.build({
        parentMessageId,
        attachments: [fileId],
      });
      const fileNoThumb = FileFactory.build({
        id: fileId,
        thumbnailPath: null,
      });

      mockDatabase.message.findUnique.mockResolvedValue({ id: parentMessageId });
      mockDatabase.message.findMany.mockResolvedValue([reply]);
      mockDatabase.file.findMany.mockResolvedValue([fileNoThumb]);

      const result = await service.getThreadRepliesWithMetadata(parentMessageId);

      expect(result.replies[0].attachments[0].hasThumbnail).toBe(false);
    });

    it('should not query files when no attachments', async () => {
      const reply = MessageFactory.build({
        parentMessageId,
        attachments: [],
      });

      mockDatabase.message.findUnique.mockResolvedValue({ id: parentMessageId });
      mockDatabase.message.findMany.mockResolvedValue([reply]);

      await service.getThreadRepliesWithMetadata(parentMessageId);

      expect(mockDatabase.file.findMany).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToThread', () => {
    const parentMessageId = 'parent-msg-123';
    const userId = 'user-123';

    it('should upsert thread subscription', async () => {
      const parent = MessageFactory.build({
        id: parentMessageId,
        parentMessageId: null,
      });
      mockDatabase.message.findUnique.mockResolvedValue(parent);
      mockDatabase.threadSubscriber.upsert.mockResolvedValue({});

      await service.subscribeToThread(parentMessageId, userId);

      expect(mockDatabase.threadSubscriber.upsert).toHaveBeenCalledWith({
        where: {
          userId_parentMessageId: { userId, parentMessageId },
        },
        create: { userId, parentMessageId },
        update: {},
      });
    });

    it('should verify parent message exists', async () => {
      mockDatabase.message.findUnique.mockResolvedValue(null);

      await expect(
        service.subscribeToThread(parentMessageId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unsubscribeFromThread', () => {
    it('should delete thread subscription', async () => {
      const parentMessageId = 'parent-msg-123';
      const userId = 'user-123';
      mockDatabase.threadSubscriber.deleteMany.mockResolvedValue({ count: 1 });

      await service.unsubscribeFromThread(parentMessageId, userId);

      expect(mockDatabase.threadSubscriber.deleteMany).toHaveBeenCalledWith({
        where: { userId, parentMessageId },
      });
    });
  });

  describe('getThreadSubscribers', () => {
    const parentMessageId = 'parent-msg-123';

    it('should return subscriber user IDs', async () => {
      mockDatabase.threadSubscriber.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const result = await service.getThreadSubscribers(parentMessageId);

      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('should exclude specified user', async () => {
      mockDatabase.threadSubscriber.findMany.mockResolvedValue([
        { userId: 'user-2' },
      ]);

      await service.getThreadSubscribers(parentMessageId, 'user-1');

      expect(mockDatabase.threadSubscriber.findMany).toHaveBeenCalledWith({
        where: {
          parentMessageId,
          userId: { not: 'user-1' },
        },
        select: { userId: true },
      });
    });

    it('should return empty array when no subscribers', async () => {
      mockDatabase.threadSubscriber.findMany.mockResolvedValue([]);

      const result = await service.getThreadSubscribers(parentMessageId);

      expect(result).toEqual([]);
    });
  });

  describe('isSubscribed', () => {
    it('should return true when subscribed', async () => {
      mockDatabase.threadSubscriber.findUnique.mockResolvedValue({
        userId: 'user-1',
        parentMessageId: 'msg-1',
      });

      const result = await service.isSubscribed('msg-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when not subscribed', async () => {
      mockDatabase.threadSubscriber.findUnique.mockResolvedValue(null);

      const result = await service.isSubscribed('msg-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('getThreadMetadata', () => {
    const parentMessageId = 'parent-msg-123';
    const lastReplyAt = new Date();

    it('should return metadata with subscription status', async () => {
      mockDatabase.message.findUnique.mockResolvedValue({
        id: parentMessageId,
        replyCount: 5,
        lastReplyAt,
      });
      mockDatabase.threadSubscriber.findUnique.mockResolvedValue({
        userId: 'user-1',
      });

      const result = await service.getThreadMetadata(parentMessageId, 'user-1');

      expect(result).toEqual({
        parentMessageId,
        replyCount: 5,
        lastReplyAt,
        isSubscribed: true,
      });
    });

    it('should return isSubscribed false when no userId provided', async () => {
      mockDatabase.message.findUnique.mockResolvedValue({
        id: parentMessageId,
        replyCount: 0,
        lastReplyAt: null,
      });

      const result = await service.getThreadMetadata(parentMessageId);

      expect(result.isSubscribed).toBe(false);
    });

    it('should throw NotFoundException when message not found', async () => {
      mockDatabase.message.findUnique.mockResolvedValue(null);

      await expect(
        service.getThreadMetadata('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('decrementReplyCount', () => {
    it('should decrement parent reply count', async () => {
      const parentMessageId = 'parent-msg-123';
      mockDatabase.message.update.mockResolvedValue({});

      await service.decrementReplyCount(parentMessageId);

      expect(mockDatabase.message.update).toHaveBeenCalledWith({
        where: { id: parentMessageId },
        data: { replyCount: { decrement: 1 } },
      });
    });
  });
});
