import { Test, TestingModule } from '@nestjs/testing';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { ReactionsService } from './reactions.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { NotificationsService } from '@/notifications/notifications.service';
import { ModerationService } from '@/moderation/moderation.service';

describe('MessagesGateway', () => {
  let gateway: MessagesGateway;
  let messagesService: MessagesService;
  let reactionsService: ReactionsService;
  let websocketService: WebsocketService;
  let notificationsService: NotificationsService;

  const mockMessagesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    enrichMessageWithFileMetadata: jest.fn(),
  };

  const mockReactionsService = {
    addReaction: jest.fn(),
    removeReaction: jest.fn(),
  };

  const mockWebsocketService = {
    sendToRoom: jest.fn(),
    setServer: jest.fn(),
  };

  const mockNotificationsService = {
    processMessageForNotifications: jest.fn().mockResolvedValue(undefined),
  };

  const mockModerationService = {
    getCommunityIdFromChannel: jest.fn().mockResolvedValue('community-123'),
    isUserTimedOut: jest.fn().mockResolvedValue({ isTimedOut: false }),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: ReactionsService,
          useValue: mockReactionsService,
        },
        {
          provide: WebsocketService,
          useValue: mockWebsocketService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: ModerationService,
          useValue: mockModerationService,
        },
      ],
    })
      .overrideGuard(WsJwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    gateway = module.get<MessagesGateway>(MessagesGateway);
    messagesService = module.get<MessagesService>(MessagesService);
    reactionsService = module.get<ReactionsService>(ReactionsService);
    websocketService = module.get<WebsocketService>(WebsocketService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should have services', () => {
    expect(messagesService).toBeDefined();
    expect(reactionsService).toBeDefined();
    expect(websocketService).toBeDefined();
    expect(notificationsService).toBeDefined();
  });

  describe('afterInit', () => {
    it('should log initialization', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      const mockServer = {} as any;

      gateway.afterInit(mockServer);

      expect(loggerSpy).toHaveBeenCalledWith('MessagesGateway initialized');
    });
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      const mockClient = { id: 'test-socket-id' } as any;

      gateway.handleConnection(mockClient);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Client connected to MessagesGateway: test-socket-id',
      );
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      const mockClient = { id: 'disconnect-socket-id' } as any;

      gateway.handleDisconnect(mockClient);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Client disconnected from MessagesGateway: disconnect-socket-id',
      );
    });
  });

  describe('handleMessage (SEND_MESSAGE)', () => {
    it('should create message and broadcast to channel', async () => {
      const payload = {
        channelId: 'channel-123',
        content: 'Test message',
      };
      const mockClient = {
        handshake: { user: { id: 'user-123' } },
      } as any;

      const createdMessage = {
        id: 'msg-123',
        ...payload,
        authorId: 'user-123',
      };
      const enrichedMessage = { ...createdMessage, files: [] };

      mockMessagesService.create.mockResolvedValue(createdMessage);
      mockMessagesService.enrichMessageWithFileMetadata.mockResolvedValue(
        enrichedMessage,
      );

      const result = await gateway.handleMessage(payload as any, mockClient);

      expect(result).toBe('msg-123');
      expect(mockMessagesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'channel-123',
          content: 'Test message',
          authorId: 'user-123',
        }),
      );
      expect(mockWebsocketService.sendToRoom).toHaveBeenCalledWith(
        'channel-123',
        ServerEvents.NEW_MESSAGE,
        {
          message: enrichedMessage,
        },
      );
    });

    it('should throw error when channelId is missing', async () => {
      const payload = {
        content: 'Test message',
      };
      const mockClient = {
        handshake: { user: { id: 'user-123' } },
      } as any;

      await expect(
        gateway.handleMessage(payload as any, mockClient),
      ).rejects.toThrow('channelId is required for channel messages');
    });
  });

  describe('handleDirectMessageWithRBAC (SEND_DM)', () => {
    it('should create DM and broadcast to DM group', async () => {
      const payload = {
        directMessageGroupId: 'dm-group-456',
        content: 'DM test message',
      };
      const mockClient = {
        handshake: { user: { id: 'user-456' } },
      } as any;

      const createdMessage = {
        id: 'msg-456',
        ...payload,
        authorId: 'user-456',
      };
      const enrichedMessage = { ...createdMessage, files: [] };

      mockMessagesService.create.mockResolvedValue(createdMessage);
      mockMessagesService.enrichMessageWithFileMetadata.mockResolvedValue(
        enrichedMessage,
      );

      const result = await gateway.handleDirectMessageWithRBAC(
        payload as any,
        mockClient,
      );

      expect(result).toBe('msg-456');
      expect(mockMessagesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          directMessageGroupId: 'dm-group-456',
          content: 'DM test message',
          authorId: 'user-456',
        }),
      );
      expect(mockWebsocketService.sendToRoom).toHaveBeenCalledWith(
        'dm-group-456',
        ServerEvents.NEW_DM,
        {
          message: enrichedMessage,
        },
      );
    });

    it('should throw error when directMessageGroupId is missing', async () => {
      const payload = {
        content: 'DM test message',
      };
      const mockClient = {
        handshake: { user: { id: 'user-456' } },
      } as any;

      await expect(
        gateway.handleDirectMessageWithRBAC(payload as any, mockClient),
      ).rejects.toThrow('directMessageGroupId is required for direct messages');
    });
  });

  describe('handleAddReaction (ADD_REACTION)', () => {
    it('should add reaction and broadcast to channel', async () => {
      const payload = {
        messageId: 'msg-789',
        emoji: '👍',
      };
      const mockClient = {
        handshake: { user: { id: 'user-789' } },
      } as any;

      const updatedMessage = {
        id: 'msg-789',
        channelId: 'channel-789',
        reactions: [{ emoji: '👍', count: 1, users: ['user-789'] }],
      };

      mockReactionsService.addReaction.mockResolvedValue(updatedMessage);

      await gateway.handleAddReaction(payload as any, mockClient);

      expect(mockReactionsService.addReaction).toHaveBeenCalledWith(
        'msg-789',
        '👍',
        'user-789',
      );
      expect(mockWebsocketService.sendToRoom).toHaveBeenCalledWith(
        'channel-789',
        ServerEvents.REACTION_ADDED,
        {
          messageId: 'msg-789',
          reaction: { emoji: '👍', count: 1, users: ['user-789'] },
        },
      );
    });

    it('should add reaction and broadcast to DM group', async () => {
      const payload = {
        messageId: 'msg-dm-999',
        emoji: '❤️',
      };
      const mockClient = {
        handshake: { user: { id: 'user-999' } },
      } as any;

      const updatedMessage = {
        id: 'msg-dm-999',
        directMessageGroupId: 'dm-group-999',
        reactions: [{ emoji: '❤️', count: 1, users: ['user-999'] }],
      };

      mockReactionsService.addReaction.mockResolvedValue(updatedMessage);

      await gateway.handleAddReaction(payload as any, mockClient);

      expect(mockWebsocketService.sendToRoom).toHaveBeenCalledWith(
        'dm-group-999',
        ServerEvents.REACTION_ADDED,
        expect.objectContaining({
          messageId: 'msg-dm-999',
        }),
      );
    });

    it('should handle reaction when no roomId', async () => {
      const payload = {
        messageId: 'msg-111',
        emoji: '👍',
      };
      const mockClient = {
        handshake: { user: { id: 'user-111' } },
      } as any;

      const updatedMessage = {
        id: 'msg-111',
        reactions: [{ emoji: '👍', count: 1, users: ['user-111'] }],
      };

      mockReactionsService.addReaction.mockResolvedValue(updatedMessage);

      await gateway.handleAddReaction(payload as any, mockClient);

      expect(mockReactionsService.addReaction).toHaveBeenCalled();
      expect(mockWebsocketService.sendToRoom).not.toHaveBeenCalled();
    });
  });

  describe('handleRemoveReaction (REMOVE_REACTION)', () => {
    it('should remove reaction and broadcast to channel', async () => {
      const payload = {
        messageId: 'msg-222',
        emoji: '👍',
      };
      const mockClient = {
        handshake: { user: { id: 'user-222' } },
      } as any;

      const updatedMessage = {
        id: 'msg-222',
        channelId: 'channel-222',
        reactions: [],
      };

      mockReactionsService.removeReaction.mockResolvedValue(updatedMessage);

      await gateway.handleRemoveReaction(payload as any, mockClient);

      expect(mockReactionsService.removeReaction).toHaveBeenCalledWith(
        'msg-222',
        '👍',
        'user-222',
      );
      expect(mockWebsocketService.sendToRoom).toHaveBeenCalledWith(
        'channel-222',
        ServerEvents.REACTION_REMOVED,
        {
          messageId: 'msg-222',
          emoji: '👍',
          reactions: [],
        },
      );
    });

    it('should remove reaction and broadcast to DM group', async () => {
      const payload = {
        messageId: 'msg-dm-333',
        emoji: '❤️',
      };
      const mockClient = {
        handshake: { user: { id: 'user-333' } },
      } as any;

      const updatedMessage = {
        id: 'msg-dm-333',
        directMessageGroupId: 'dm-group-333',
        reactions: [],
      };

      mockReactionsService.removeReaction.mockResolvedValue(updatedMessage);

      await gateway.handleRemoveReaction(payload as any, mockClient);

      expect(mockWebsocketService.sendToRoom).toHaveBeenCalledWith(
        'dm-group-333',
        ServerEvents.REACTION_REMOVED,
        expect.objectContaining({
          messageId: 'msg-dm-333',
          emoji: '❤️',
        }),
      );
    });

    it('should handle remove reaction when no roomId', async () => {
      const payload = {
        messageId: 'msg-444',
        emoji: '👍',
      };
      const mockClient = {
        handshake: { user: { id: 'user-444' } },
      } as any;

      const updatedMessage = {
        id: 'msg-444',
        reactions: [],
      };

      mockReactionsService.removeReaction.mockResolvedValue(updatedMessage);

      await gateway.handleRemoveReaction(payload as any, mockClient);

      expect(mockReactionsService.removeReaction).toHaveBeenCalled();
      expect(mockWebsocketService.sendToRoom).not.toHaveBeenCalled();
    });
  });
});
