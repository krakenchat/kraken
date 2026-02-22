import { TestBed } from '@suites/unit';
import { NotificationsGateway } from './notifications.gateway';
import { ServerEvents } from '@kraken/shared';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let mockServer: { to: jest.Mock };
  let mockRoom: { emit: jest.Mock };

  beforeEach(async () => {
    const { unit } = await TestBed.solitary(NotificationsGateway).compile();

    gateway = unit;

    // Set up mock server chain: server.to(room).emit(event, data)
    mockRoom = { emit: jest.fn() };
    mockServer = { to: jest.fn().mockReturnValue(mockRoom) };
    gateway.server = mockServer as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('emitNotificationToUser', () => {
    it('should emit to the correct user room', () => {
      const userId = 'user-123';
      const notification = {
        id: 'n-1',
        type: 'MENTION',
        messageId: 'msg-1',
        channelId: 'ch-1',
        directMessageGroupId: null,
        authorId: 'author-1',
        author: {
          id: 'author-1',
          username: 'sender',
          displayName: 'Sender',
          avatarUrl: null,
        },
        message: {
          id: 'msg-1',
          spans: [{ type: 'PLAINTEXT', text: 'Hello' }],
          channelId: 'ch-1',
          directMessageGroupId: null,
        },
        channel: {
          id: 'ch-1',
          name: 'general',
          communityId: 'community-1',
        },
        createdAt: new Date(),
        read: false,
      } as any;

      gateway.emitNotificationToUser(userId, notification);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
      expect(mockRoom.emit).toHaveBeenCalledWith(
        ServerEvents.NEW_NOTIFICATION,
        expect.objectContaining({
          notificationId: 'n-1',
          type: 'MENTION',
          communityId: 'community-1',
          channelName: 'general',
        }),
      );
    });

    it('should handle null channel gracefully', () => {
      const userId = 'user-123';
      const notification = {
        id: 'n-2',
        type: 'DIRECT_MESSAGE',
        messageId: 'msg-2',
        channelId: null,
        directMessageGroupId: 'dm-1',
        authorId: 'author-1',
        author: null,
        message: null,
        channel: null,
        createdAt: new Date(),
        read: false,
      } as any;

      gateway.emitNotificationToUser(userId, notification);

      expect(mockRoom.emit).toHaveBeenCalledWith(
        ServerEvents.NEW_NOTIFICATION,
        expect.objectContaining({
          communityId: null,
          channelName: null,
        }),
      );
    });
  });

  describe('emitNotificationRead', () => {
    it('should emit read event to user room', () => {
      const userId = 'user-123';
      const notificationId = 'n-1';

      gateway.emitNotificationRead(userId, notificationId);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-123');
      expect(mockRoom.emit).toHaveBeenCalledWith(
        ServerEvents.NOTIFICATION_READ,
        { notificationId: 'n-1' },
      );
    });
  });

  describe('lifecycle', () => {
    it('afterInit should not throw', () => {
      expect(() => gateway.afterInit({} as any)).not.toThrow();
    });

    it('handleConnection should not throw', () => {
      expect(() =>
        gateway.handleConnection({ id: 'test-socket' } as any),
      ).not.toThrow();
    });

    it('handleDisconnect should not throw', () => {
      expect(() =>
        gateway.handleDisconnect({ id: 'test-socket' } as any),
      ).not.toThrow();
    });
  });
});
