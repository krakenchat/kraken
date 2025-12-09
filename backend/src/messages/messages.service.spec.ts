import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { DatabaseService } from '@/database/database.service';
import { FileService } from '@/file/file.service';
import { NotFoundException } from '@nestjs/common';
import { SpanType } from '@prisma/client';
import { createMockDatabase, MessageFactory, FileFactory } from '@/test-utils';

describe('MessagesService', () => {
  let service: MessagesService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let fileService: FileService;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
        {
          provide: FileService,
          useValue: {
            markForDeletion: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    fileService = module.get<FileService>(FileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a message', async () => {
      const createDto = {
        channelId: 'channel-123',
        authorId: 'user-123',
        spans: [
          {
            type: SpanType.PLAINTEXT,
            text: 'Hello world',
            userId: null,
            specialKind: null,
            channelId: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any;
      const createdMessage = MessageFactory.build(createDto);

      mockDatabase.message.create.mockResolvedValue(createdMessage);

      const result = await service.create(createDto);

      expect(result).toEqual(createdMessage);

      expect(mockDatabase.message.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          searchText: 'hello world', // Lowercase for MongoDB case-insensitive search
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a message by id', async () => {
      const message = MessageFactory.build();

      mockDatabase.message.findUniqueOrThrow.mockResolvedValue(message);

      const result = await service.findOne(message.id);

      expect(result).toEqual(message);
      expect(mockDatabase.message.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: message.id },
      });
    });

    it('should throw NotFoundException when message not found', async () => {
      mockDatabase.message.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a message', async () => {
      const messageId = 'msg-123';
      const updateDto = {
        spans: [
          {
            type: SpanType.PLAINTEXT,
            text: 'Updated text',
            userId: null,
            specialKind: null,
            channelId: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any;
      const updatedMessage = MessageFactory.build({
        id: messageId,
        ...updateDto,
      });

      mockDatabase.message.update.mockResolvedValue(updatedMessage);

      const result = await service.update(messageId, updateDto);

      expect(result).toEqual(updatedMessage);
      expect(mockDatabase.message.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: {
          ...updateDto,
          searchText: 'updated text', // Lowercase for MongoDB case-insensitive search
        },
      });
    });

    it('should mark removed attachments for deletion', async () => {
      const messageId = 'msg-123';
      const originalAttachments = ['file-1', 'file-2', 'file-3'];
      const newAttachments = ['file-1', 'file-3']; // file-2 removed
      const updateDto = { attachments: newAttachments };

      mockDatabase.message.update.mockResolvedValue(MessageFactory.build());

      await service.update(messageId, updateDto, originalAttachments);

      // markForDeletion is called with fileId and transaction client
      expect(fileService.markForDeletion).toHaveBeenCalledWith(
        'file-2',
        expect.any(Object),
      );
      expect(fileService.markForDeletion).toHaveBeenCalledTimes(1);
    });

    it('should mark multiple removed attachments for deletion', async () => {
      const messageId = 'msg-123';
      const originalAttachments = ['file-1', 'file-2', 'file-3'];
      const newAttachments = ['file-1']; // file-2 and file-3 removed
      const updateDto = { attachments: newAttachments };

      mockDatabase.message.update.mockResolvedValue(MessageFactory.build());

      await service.update(messageId, updateDto, originalAttachments);

      // markForDeletion is called with fileId and transaction client
      expect(fileService.markForDeletion).toHaveBeenCalledWith(
        'file-2',
        expect.any(Object),
      );
      expect(fileService.markForDeletion).toHaveBeenCalledWith(
        'file-3',
        expect.any(Object),
      );
      expect(fileService.markForDeletion).toHaveBeenCalledTimes(2);
    });

    it('should not mark files for deletion if no attachments changed', async () => {
      const messageId = 'msg-123';
      const updateDto = {
        spans: [
          {
            type: SpanType.PLAINTEXT,
            text: 'New text',
            userId: null,
            specialKind: null,
            channelId: null,
            communityId: null,
            aliasId: null,
          },
        ],
      } as any;

      mockDatabase.message.update.mockResolvedValue(MessageFactory.build());

      await service.update(messageId, updateDto);

      expect(fileService.markForDeletion).not.toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      mockDatabase.message.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.update('msg-id', {})).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('remove', () => {
    it('should delete a message', async () => {
      const messageId = 'msg-123';
      const deletedMessage = MessageFactory.build({ id: messageId });

      mockDatabase.message.delete.mockResolvedValue(deletedMessage);

      const result = await service.remove(messageId);

      expect(result).toEqual(deletedMessage);
      expect(mockDatabase.message.delete).toHaveBeenCalledWith({
        where: { id: messageId },
      });
    });

    it('should mark attachments for deletion when removing message', async () => {
      const messageId = 'msg-123';
      const attachments = ['file-1', 'file-2'];

      mockDatabase.message.delete.mockResolvedValue(MessageFactory.build());

      await service.remove(messageId, attachments);

      // markForDeletion is called with fileId and transaction client
      expect(fileService.markForDeletion).toHaveBeenCalledWith(
        'file-1',
        expect.any(Object),
      );
      expect(fileService.markForDeletion).toHaveBeenCalledWith(
        'file-2',
        expect.any(Object),
      );
      expect(fileService.markForDeletion).toHaveBeenCalledTimes(2);
    });

    it('should not mark files for deletion if no attachments', async () => {
      mockDatabase.message.delete.mockResolvedValue(MessageFactory.build());

      await service.remove('msg-id', []);

      expect(fileService.markForDeletion).not.toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      mockDatabase.message.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.remove('msg-id')).rejects.toThrow('Delete failed');
    });
  });

  describe('findAllForChannel', () => {
    it('should return messages for a channel', async () => {
      const channelId = 'channel-123';
      const messages = MessageFactory.buildMany(3, { channelId });
      const files = messages
        .flatMap((m) => m.attachments)
        .map((id) => FileFactory.build({ id }));

      mockDatabase.message.findMany.mockResolvedValue(messages);
      mockDatabase.file.findMany.mockResolvedValue(files);

      const result = await service.findAllForChannel(channelId);

      expect(result.messages).toHaveLength(3);
      expect(mockDatabase.message.findMany).toHaveBeenCalledWith({
        where: { channelId },
        orderBy: { sentAt: 'desc' },
        take: 100, // limit * 2 to account for thread replies filtering
      });
    });

    it('should return continuation token when limit reached', async () => {
      const channelId = 'channel-123';
      const messages = MessageFactory.buildMany(50, { channelId });

      mockDatabase.message.findMany.mockResolvedValue(messages);
      mockDatabase.file.findMany.mockResolvedValue([]);

      const result = await service.findAllForChannel(channelId, 50);

      expect(result.continuationToken).toBe(messages[49].id);
    });

    it('should use continuation token for pagination', async () => {
      const channelId = 'channel-123';
      const continuationToken = 'msg-50';
      const messages = MessageFactory.buildMany(10, { channelId });

      mockDatabase.message.findMany.mockResolvedValue(messages);
      mockDatabase.file.findMany.mockResolvedValue([]);

      await service.findAllForChannel(channelId, 50, continuationToken);

      expect(mockDatabase.message.findMany).toHaveBeenCalledWith({
        where: { channelId },
        orderBy: { sentAt: 'desc' },
        take: 100, // limit * 2 to account for thread replies filtering
        cursor: { id: continuationToken },
        skip: 1,
      });
    });

    it('should throw NotFoundException when no channelId provided', async () => {
      await expect(service.findAllForChannel('')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should enrich messages with file metadata', async () => {
      const channelId = 'channel-123';
      const file1 = FileFactory.build({ id: 'file-1', filename: 'test.jpg' });
      const file2 = FileFactory.build({ id: 'file-2', filename: 'doc.pdf' });
      const messages = [
        MessageFactory.build({ channelId, attachments: ['file-1', 'file-2'] }),
      ];

      mockDatabase.message.findMany.mockResolvedValue(messages);
      mockDatabase.file.findMany.mockResolvedValue([file1, file2]);

      const result = await service.findAllForChannel(channelId);

      expect(result.messages[0].attachments).toEqual([file1, file2]);
    });

    it('should filter out missing files from attachments', async () => {
      const channelId = 'channel-123';
      const file1 = FileFactory.build({ id: 'file-1' });
      const messages = [
        MessageFactory.build({
          channelId,
          attachments: ['file-1', 'file-missing'],
        }),
      ];

      mockDatabase.message.findMany.mockResolvedValue(messages);
      mockDatabase.file.findMany.mockResolvedValue([file1]);

      const result = await service.findAllForChannel(channelId);

      expect(result.messages[0].attachments).toHaveLength(1);
      expect(result.messages[0].attachments[0].id).toBe('file-1');
    });
  });

  describe('findAllForDirectMessageGroup', () => {
    it('should return messages for a DM group', async () => {
      const dmGroupId = 'dm-123';
      const messages = MessageFactory.buildMany(3, {
        directMessageGroupId: dmGroupId,
        channelId: null,
      });

      mockDatabase.message.findMany.mockResolvedValue(messages);
      mockDatabase.file.findMany.mockResolvedValue([]);

      const result = await service.findAllForDirectMessageGroup(dmGroupId);

      expect(result.messages).toHaveLength(3);
      expect(mockDatabase.message.findMany).toHaveBeenCalledWith({
        where: { directMessageGroupId: dmGroupId },
        orderBy: { sentAt: 'desc' },
        take: 100, // limit * 2 to account for thread replies filtering
      });
    });

    it('should throw NotFoundException when no dmGroupId provided', async () => {
      await expect(service.findAllForDirectMessageGroup('')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // Note: addReaction and removeReaction tests moved to reactions.service.spec.ts

  describe('addAttachment', () => {
    it('should add file to attachments and decrement pending', async () => {
      const messageId = 'msg-123';
      const fileId = 'file-123';
      const updatedMessage = MessageFactory.build({
        id: messageId,
        attachments: [fileId],
        pendingAttachments: 0,
      });

      mockDatabase.message.update.mockResolvedValue(updatedMessage);

      const result = await service.addAttachment(messageId, fileId);

      expect(result).toEqual(updatedMessage);
      expect(mockDatabase.message.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: {
          attachments: { push: fileId },
          pendingAttachments: { decrement: 1 },
        },
      });
    });

    it('should only decrement pending when no fileId provided', async () => {
      const messageId = 'msg-123';
      const updatedMessage = MessageFactory.build({
        id: messageId,
        pendingAttachments: 1,
      });

      mockDatabase.message.update.mockResolvedValue(updatedMessage);

      await service.addAttachment(messageId);

      expect(mockDatabase.message.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: {
          pendingAttachments: { decrement: 1 },
        },
      });
    });

    it('should handle errors when adding attachment', async () => {
      mockDatabase.message.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.addAttachment('msg-id', 'file-id')).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('enrichMessageWithFileMetadata', () => {
    it('should enrich message with file metadata', async () => {
      const file1 = FileFactory.build({ id: 'file-1', filename: 'test.jpg' });
      const file2 = FileFactory.build({ id: 'file-2', filename: 'doc.pdf' });
      const message = MessageFactory.build({
        attachments: ['file-1', 'file-2'],
      });

      mockDatabase.file.findMany.mockResolvedValue([file1, file2]);

      const result = await service.enrichMessageWithFileMetadata(
        message as any,
      );

      expect(result.attachments).toEqual([file1, file2]);
      expect(mockDatabase.file.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['file-1', 'file-2'] } },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          fileType: true,
          size: true,
        },
      });
    });

    it('should return empty attachments when message has no files', async () => {
      const message = MessageFactory.build({ attachments: [] });

      const result = await service.enrichMessageWithFileMetadata(
        message as any,
      );

      expect(result.attachments).toEqual([]);
      expect(mockDatabase.file.findMany).not.toHaveBeenCalled();
    });

    it('should filter out missing files', async () => {
      const file1 = FileFactory.build({ id: 'file-1' });
      const message = MessageFactory.build({
        attachments: ['file-1', 'file-missing'],
      });

      mockDatabase.file.findMany.mockResolvedValue([file1]);

      const result = await service.enrichMessageWithFileMetadata(
        message as any,
      );

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].id).toBe('file-1');
    });
  });
});
