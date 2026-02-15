import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

// Mock notification utilities
vi.mock('../../utils/notifications', () => ({
  showNotification: vi.fn(),
  formatNotificationContent: vi.fn(() => ({ title: 'Test', body: 'test body' })),
  isNotificationPermissionGranted: vi.fn(() => false),
  getNotificationPermission: vi.fn(() => 'default' as NotificationPermission),
}));

vi.mock('../../utils/notificationTracking', () => ({
  markNotificationAsShown: vi.fn(),
}));

vi.mock('../../utils/platform', () => ({
  isElectron: vi.fn(() => false),
  getElectronAPI: vi.fn(() => null),
}));

import { useNotifications } from '../../hooks/useNotifications';
import {
  notificationsControllerGetNotificationsQueryKey,
  notificationsControllerGetUnreadCountQueryKey,
} from '../../api-client/@tanstack/react-query.gen';
import type { NotificationListResponseDto, UnreadCountResponseDto } from '../../api-client';
import {
  createTestQueryClient,
  createMockSocket,
  createTestWrapper,
} from '../test-utils';
import type { MockSocket } from '../test-utils';

let queryClient: ReturnType<typeof createTestQueryClient>;
let mockSocket: MockSocket;

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = createTestQueryClient();
  mockSocket = createMockSocket();
  mockNavigate.mockReset();
});

function renderNotifications(options = {}) {
  return renderHook(() => useNotifications(options), {
    wrapper: createTestWrapper({ queryClient, socket: mockSocket }),
  });
}

function createNotificationPayload(overrides = {}) {
  return {
    notificationId: 'notif-1',
    type: 'MENTION',
    messageId: 'msg-1',
    channelId: 'channel-1',
    communityId: 'community-1',
    directMessageGroupId: null,
    authorId: 'author-1',
    read: false,
    createdAt: '2025-01-01T00:00:00Z',
    channelName: 'general',
    author: { id: 'author-1', username: 'TestUser', avatarUrl: null },
    message: {
      id: 'msg-1',
      spans: [{ type: 'PLAINTEXT', text: 'Hello @you' }],
    },
    ...overrides,
  };
}

function seedNotificationsCache(notifications: NotificationListResponseDto['notifications'] = []) {
  const key = notificationsControllerGetNotificationsQueryKey();
  queryClient.setQueryData(key, {
    notifications,
    total: notifications.length,
    unreadCount: notifications.filter((n) => !n.read).length,
  } satisfies NotificationListResponseDto);
}

function seedUnreadCountCache(count: number) {
  const key = notificationsControllerGetUnreadCountQueryKey();
  queryClient.setQueryData(key, { count } satisfies UnreadCountResponseDto);
}

describe('useNotifications', () => {
  describe('event registration', () => {
    it('registers WebSocket event handlers on mount', () => {
      renderNotifications();

      expect(mockSocket.on).toHaveBeenCalledWith('newNotification', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('notificationRead', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('unregisters event handlers on unmount', () => {
      const { unmount } = renderNotifications();
      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith('newNotification', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('notificationRead', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    });
  });

  describe('NEW_NOTIFICATION', () => {
    it('prepends notification to list cache', async () => {
      const key = notificationsControllerGetNotificationsQueryKey();
      seedNotificationsCache([]);

      renderNotifications();

      await act(() => mockSocket.simulateEvent('newNotification', createNotificationPayload()));

      const data = queryClient.getQueryData(key) as NotificationListResponseDto;
      expect(data.notifications).toHaveLength(1);
      expect(data.notifications[0].id).toBe('notif-1');
    });

    it('increments unread count for unread notifications', async () => {
      const key = notificationsControllerGetUnreadCountQueryKey();
      seedUnreadCountCache(3);

      renderNotifications();

      await act(() =>
        mockSocket.simulateEvent('newNotification', createNotificationPayload({ read: false })),
      );

      const data = queryClient.getQueryData(key) as UnreadCountResponseDto;
      expect(data.count).toBe(4);
    });

    it('does not increment unread count for already-read notifications', async () => {
      const key = notificationsControllerGetUnreadCountQueryKey();
      seedUnreadCountCache(3);

      renderNotifications();

      await act(() =>
        mockSocket.simulateEvent('newNotification', createNotificationPayload({ read: true })),
      );

      const data = queryClient.getQueryData(key) as UnreadCountResponseDto;
      expect(data.count).toBe(3);
    });

    it('does not add duplicate notifications', async () => {
      const key = notificationsControllerGetNotificationsQueryKey();
      seedNotificationsCache([
        {
          id: 'notif-1',
          userId: '',
          type: 'MENTION',
          messageId: 'msg-1',
          channelId: 'channel-1',
          communityId: 'community-1',
          directMessageGroupId: null,
          authorId: 'author-1',
          parentMessageId: null,
          read: false,
          dismissed: false,
          createdAt: '2025-01-01T00:00:00Z',
        },
      ]);

      renderNotifications();

      await act(() => mockSocket.simulateEvent('newNotification', createNotificationPayload()));

      const data = queryClient.getQueryData(key) as NotificationListResponseDto;
      expect(data.notifications).toHaveLength(1);
    });

    it('initializes unread count to 1 when cache is empty', async () => {
      const key = notificationsControllerGetUnreadCountQueryKey();
      // No cache seeded

      renderNotifications();

      await act(() =>
        mockSocket.simulateEvent('newNotification', createNotificationPayload({ read: false })),
      );

      const data = queryClient.getQueryData(key) as UnreadCountResponseDto;
      expect(data.count).toBe(1);
    });
  });

  describe('NOTIFICATION_READ', () => {
    it('marks notification as read in list cache', async () => {
      const key = notificationsControllerGetNotificationsQueryKey();
      seedNotificationsCache([
        {
          id: 'notif-1',
          userId: '',
          type: 'MENTION',
          messageId: 'msg-1',
          channelId: 'channel-1',
          communityId: 'community-1',
          directMessageGroupId: null,
          authorId: 'author-1',
          parentMessageId: null,
          read: false,
          dismissed: false,
          createdAt: '2025-01-01T00:00:00Z',
        },
      ]);

      renderNotifications();

      await act(() =>
        mockSocket.simulateEvent('notificationRead', { notificationId: 'notif-1' }),
      );

      const data = queryClient.getQueryData(key) as NotificationListResponseDto;
      expect(data.notifications[0].read).toBe(true);
      expect(data.unreadCount).toBe(0);
    });

    it('decrements unread count cache', async () => {
      const key = notificationsControllerGetUnreadCountQueryKey();
      seedUnreadCountCache(5);

      renderNotifications();

      await act(() =>
        mockSocket.simulateEvent('notificationRead', { notificationId: 'notif-1' }),
      );

      const data = queryClient.getQueryData(key) as UnreadCountResponseDto;
      expect(data.count).toBe(4);
    });

    it('does not let unread count go below zero', async () => {
      const key = notificationsControllerGetUnreadCountQueryKey();
      seedUnreadCountCache(0);

      renderNotifications();

      await act(() =>
        mockSocket.simulateEvent('notificationRead', { notificationId: 'notif-1' }),
      );

      const data = queryClient.getQueryData(key) as UnreadCountResponseDto;
      expect(data.count).toBe(0);
    });
  });

  describe('connect (reconnect)', () => {
    it('invalidates unread count query on reconnect', async () => {
      seedUnreadCountCache(3);
      renderNotifications();

      await act(() => mockSocket.simulateEvent('connect'));

      const query = queryClient
        .getQueryCache()
        .find({ queryKey: notificationsControllerGetUnreadCountQueryKey() });
      expect(query?.isStale()).toBe(true);
    });

    it('invalidates notifications list query on reconnect', async () => {
      seedNotificationsCache([]);
      renderNotifications();

      await act(() => mockSocket.simulateEvent('connect'));

      const query = queryClient
        .getQueryCache()
        .find({ queryKey: notificationsControllerGetNotificationsQueryKey() });
      expect(query?.isStale()).toBe(true);
    });
  });
});
