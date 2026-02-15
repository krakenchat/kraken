/**
 * useNotifications Hook
 *
 * Manages real-time notifications via WebSocket and displays browser/Electron notifications.
 * Integrates with TanStack Query cache for notification management.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '../utils/logger';
import { useNavigate } from 'react-router-dom';
import { useSocket } from './useSocket';
import { ServerEvents } from '@kraken/shared';
import {
  NewNotificationPayload,
  NotificationReadPayload,
} from '../types/notification.type';
import {
  showNotification,
  formatNotificationContent,
  isNotificationPermissionGranted,
  getNotificationPermission,
} from '../utils/notifications';
import { markNotificationAsShown } from '../utils/notificationTracking';
import { isElectron, getElectronAPI } from '../utils/platform';
import {
  notificationsControllerGetNotificationsQueryKey,
  notificationsControllerGetUnreadCountQueryKey,
} from '../api-client/@tanstack/react-query.gen';
import type {
  NotificationListResponseDto,
  UnreadCountResponseDto,
  NotificationDto,
} from '../api-client';

/**
 * Options for the useNotifications hook
 */
export interface UseNotificationsOptions {
  /**
   * Whether to automatically show desktop notifications
   * @default true
   */
  showDesktopNotifications?: boolean;

  /**
   * Whether to play notification sounds
   * @default true
   */
  playSound?: boolean;

  /**
   * Whether the user has an active push subscription.
   * When true, desktop notifications are handled by the service worker push handler
   * instead of the browser Notification API, preventing duplicates.
   * @default false
   */
  isPushSubscribed?: boolean;

  /**
   * Callback when a notification is received
   */
  onNotificationReceived?: (notification: NewNotificationPayload) => void;

  /**
   * Callback when a notification is clicked (in addition to default navigation)
   */
  onNotificationClick?: (notificationId: string) => void;
}

/**
 * Hook for managing notifications and WebSocket events
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    showDesktopNotifications = true,
    playSound = true,
    isPushSubscribed = false,
    onNotificationReceived,
    onNotificationClick,
  } = options;

  const socket = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Store notifications for lookup when Electron click events come in
  const notificationsRef = useRef<Map<string, NewNotificationPayload>>(new Map());

  // Initialize notification sound
  // Note: Sound feature is disabled until a sound file is added to /public/sounds/
  const soundEnabledRef = useRef(false);

  useEffect(() => {
    if (playSound && typeof Audio !== 'undefined') {
      // Try to load the notification sound
      const audio = new Audio('/sounds/notification.mp3');
      audio.addEventListener('canplaythrough', () => {
        audioRef.current = audio;
        soundEnabledRef.current = true;
      });
      audio.addEventListener('error', () => {
        // Sound file not found - this is expected if no sound file has been added
        soundEnabledRef.current = false;
      });
      // Preload the audio
      audio.load();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [playSound]);

  /**
   * Play notification sound (if a sound file is available)
   */
  const playNotificationSound = useCallback(() => {
    if (audioRef.current && soundEnabledRef.current && playSound) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        logger.error('[Notifications] Error playing sound:', error);
      });
    }
  }, [playSound]);

  /**
   * Navigate to the source of a notification
   */
  const navigateToNotification = useCallback(
    (notification: { communityId?: string | null; channelId?: string | null; directMessageGroupId?: string | null }) => {
      if (notification.communityId && notification.channelId) {
        // Channel notification - navigate to the channel
        navigate(`/community/${notification.communityId}/channel/${notification.channelId}`);
      } else if (notification.directMessageGroupId) {
        // DM notification - navigate to direct messages with group selected
        navigate(`/direct-messages?group=${notification.directMessageGroupId}`);
      }
    },
    [navigate]
  );

  /**
   * Handle notification click (from desktop notification or Electron)
   */
  const handleNotificationClicked = useCallback(
    (notificationId: string) => {
      // Look up the notification data
      const notification = notificationsRef.current.get(notificationId);
      if (notification) {
        navigateToNotification(notification);
      }
      // Call custom callback if provided
      onNotificationClick?.(notificationId);
    },
    [navigateToNotification, onNotificationClick]
  );

  /**
   * Handle new notification from WebSocket
   */
  const handleNewNotification = useCallback(
    async (payload: NewNotificationPayload) => {
      logger.dev('[Notifications] New notification received:', payload);

      // Store notification for later lookup (e.g., Electron click events)
      notificationsRef.current.set(payload.notificationId, payload);

      // Convert WebSocket payload to NotificationDto shape for TQ cache
      const notification: NotificationDto = {
        id: payload.notificationId,
        userId: '',
        type: payload.type,
        messageId: payload.messageId ?? null,
        channelId: payload.channelId ?? null,
        communityId: payload.communityId ?? null,
        directMessageGroupId: payload.directMessageGroupId ?? null,
        authorId: payload.authorId,
        parentMessageId: null,
        read: payload.read,
        dismissed: false,
        createdAt: payload.createdAt,
        author: payload.author ? {
          id: payload.author.id || '',
          username: payload.author.username,
          avatarUrl: payload.author.avatarUrl ?? null,
        } : undefined,
        message: payload.message ? {
          id: payload.message.id || '',
          content: '',
          spans: payload.message.spans.map((s) => ({
            type: s.type,
            text: s.text,
            userId: s.userId,
          })),
        } : undefined,
      };

      // Prepend to all notifications query caches (different consumers use different query params)
      const notificationsQueryKey = notificationsControllerGetNotificationsQueryKey();
      queryClient.setQueriesData<NotificationListResponseDto>(
        { queryKey: notificationsQueryKey },
        (old) => {
          if (!old) return old;
          // Check if already exists
          if (old.notifications.some((n) => n.id === notification.id)) return old;
          return {
            ...old,
            notifications: [notification, ...old.notifications].slice(0, 100),
            total: old.total + 1,
            unreadCount: notification.read ? old.unreadCount : old.unreadCount + 1,
          };
        }
      );

      // Increment unread count cache
      if (!notification.read) {
        const unreadCountQueryKey = notificationsControllerGetUnreadCountQueryKey();
        queryClient.setQueryData(
          unreadCountQueryKey,
          (old: UnreadCountResponseDto | undefined) => {
            if (!old) return { count: 1 };
            return { count: old.count + 1 };
          }
        );
      }

      // Call custom callback if provided
      onNotificationReceived?.(payload);

      // Play sound
      if (playSound) {
        playNotificationSound();
      }

      // Show desktop notification if enabled and permission granted.
      // Skip when push is subscribed — the service worker push handler shows
      // the notification instead, preventing duplicates.
      if (showDesktopNotifications && isNotificationPermissionGranted() && !isPushSubscribed) {
        // Extract message text from spans
        const messageText = payload.message?.spans
          .filter((span) => span.type === 'PLAINTEXT')
          .map((span) => span.text)
          .join('');

        const { title, body } = formatNotificationContent({
          type: payload.type,
          authorUsername: payload.author?.username || 'Unknown',
          messageText,
          channelName: payload.channelName ?? undefined,
        });

        await showNotification({
          title,
          body,
          icon: payload.author?.avatarUrl,
          tag: payload.notificationId,
          data: {
            notificationId: payload.notificationId,
            messageId: payload.messageId,
            channelId: payload.channelId,
            communityId: payload.communityId,
            directMessageGroupId: payload.directMessageGroupId,
          },
          onClick: () => {
            handleNotificationClicked(payload.notificationId);
          },
        });

        // Mark as shown (module-scoped tracking)
        markNotificationAsShown(payload.notificationId);
      }
    },
    [
      queryClient,
      showDesktopNotifications,
      playSound,
      isPushSubscribed,
      playNotificationSound,
      onNotificationReceived,
      handleNotificationClicked,
    ]
  );

  /**
   * Handle notification read status update from WebSocket
   */
  const handleNotificationRead = useCallback(
    (payload: NotificationReadPayload) => {
      logger.dev('[Notifications] Notification marked as read:', payload);

      // Update notification in all TQ caches (different consumers use different query params)
      const notificationsQueryKey = notificationsControllerGetNotificationsQueryKey();
      queryClient.setQueriesData<NotificationListResponseDto>(
        { queryKey: notificationsQueryKey },
        (old) => {
          if (!old) return old;
          const notification = old.notifications.find((n) => n.id === payload.notificationId);
          if (!notification || notification.read) return old;
          return {
            ...old,
            notifications: old.notifications.map((n) =>
              n.id === payload.notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, old.unreadCount - 1),
          };
        }
      );

      // Decrement unread count cache
      const unreadCountQueryKey = notificationsControllerGetUnreadCountQueryKey();
      queryClient.setQueryData(
        unreadCountQueryKey,
        (old: UnreadCountResponseDto | undefined) => {
          if (!old) return old;
          return { count: Math.max(0, old.count - 1) };
        }
      );
    },
    [queryClient]
  );

  /**
   * Set up WebSocket event listeners and reconnect-based cache invalidation.
   * If the socket disconnects and reconnects, any events during the gap are lost,
   * so we re-fetch notification data on reconnect.
   */
  useEffect(() => {
    if (!socket) return;

    socket.on(ServerEvents.NEW_NOTIFICATION, handleNewNotification);
    socket.on(ServerEvents.NOTIFICATION_READ, handleNotificationRead);

    const handleReconnect = () => {
      logger.dev('[Notifications] Socket reconnected — invalidating notification queries');
      queryClient.invalidateQueries({ queryKey: notificationsControllerGetUnreadCountQueryKey() });
      queryClient.invalidateQueries({ queryKey: notificationsControllerGetNotificationsQueryKey() });
    };
    socket.on('connect', handleReconnect);

    return () => {
      socket.off(ServerEvents.NEW_NOTIFICATION, handleNewNotification);
      socket.off(ServerEvents.NOTIFICATION_READ, handleNotificationRead);
      socket.off('connect', handleReconnect);
    };
  }, [socket, handleNewNotification, handleNotificationRead, queryClient]);

  /**
   * Set up Electron notification click handler
   * When user clicks a notification in Electron, this navigates to the source
   */
  useEffect(() => {
    if (!isElectron()) return;

    const electronAPI = getElectronAPI();
    if (!electronAPI?.onNotificationClick) return;

    const unsubscribe = electronAPI.onNotificationClick((notificationId: string) => {
      logger.dev('[Notifications] Electron notification clicked:', notificationId);
      handleNotificationClicked(notificationId);
    });

    return () => {
      unsubscribe?.();
    };
  }, [handleNotificationClicked]);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async () => {
    const { requestNotificationPermission } = await import('../utils/notifications');
    return requestNotificationPermission();
  }, []);

  /**
   * Check current notification permission
   */
  const checkPermission = useCallback(() => {
    return getNotificationPermission();
  }, []);

  return {
    requestPermission,
    checkPermission,
    navigateToNotification,
  };
}
