/**
 * useNotifications Hook
 *
 * Manages real-time notifications via WebSocket and displays browser/Electron notifications.
 * Integrates with Redux state for notification management.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import { ServerEvents } from '../types/server-events.enum';
import {
  NewNotificationPayload,
  NotificationReadPayload,
} from '../types/notification.type';
import {
  showNotification,
  formatNotificationContent,
  getNotificationPermission,
} from '../utils/notifications';
import { useAppDispatch } from '../app/hooks';
import {
  addNotification,
  markNotificationAsRead as markAsReadAction,
  markNotificationAsShown,
} from '../features/notifications/notificationsSlice';

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
   * Callback when a notification is received
   */
  onNotificationReceived?: (notification: NewNotificationPayload) => void;

  /**
   * Callback when a notification is clicked
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
    onNotificationReceived,
    onNotificationClick,
  } = options;

  const socket = useSocket();
  const dispatch = useAppDispatch();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize notification sound
  useEffect(() => {
    if (playSound && typeof Audio !== 'undefined') {
      // TODO: Add notification sound file to public assets
      // audioRef.current = new Audio('/sounds/notification.mp3');
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [playSound]);

  /**
   * Play notification sound
   */
  const playNotificationSound = useCallback(() => {
    if (audioRef.current && playSound) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.error('[Notifications] Error playing sound:', error);
      });
    }
  }, [playSound]);

  /**
   * Handle new notification from WebSocket
   */
  const handleNewNotification = useCallback(
    async (payload: NewNotificationPayload) => {
      console.log('[Notifications] New notification received:', payload);

      // Add notification to Redux state
      dispatch(addNotification(payload));

      // Call custom callback if provided
      onNotificationReceived?.(payload);

      // Note: We don't check if shown here because we want to show all new notifications
      // The selectIsNotificationShown selector can be used elsewhere if needed

      // Play sound
      if (playSound) {
        playNotificationSound();
      }

      // Show desktop notification if enabled and permission granted
      if (showDesktopNotifications && getNotificationPermission() === 'granted') {
        // Extract message text from spans
        const messageText = payload.message?.spans
          .filter((span) => span.type === 'PLAINTEXT')
          .map((span) => span.text)
          .join('');

        const { title, body } = formatNotificationContent({
          type: payload.type,
          authorUsername: payload.author?.username || 'Unknown',
          messageText,
          // TODO: Fetch channel/DM group names from state
          // channelName: ...,
          // dmGroupName: ...,
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
            directMessageGroupId: payload.directMessageGroupId,
          },
          onClick: () => {
            onNotificationClick?.(payload.notificationId);
            // TODO: Navigate to the message/channel
          },
        });

        // Mark as shown
        dispatch(markNotificationAsShown(payload.notificationId));
      }
    },
    [
      dispatch,
      showDesktopNotifications,
      playSound,
      playNotificationSound,
      onNotificationReceived,
      onNotificationClick,
    ]
  );

  /**
   * Handle notification read status update from WebSocket
   */
  const handleNotificationRead = useCallback(
    (payload: NotificationReadPayload) => {
      console.log('[Notifications] Notification marked as read:', payload);

      // Update notification state in Redux
      dispatch(markAsReadAction(payload.notificationId));
    },
    [dispatch]
  );

  /**
   * Set up WebSocket event listeners
   */
  useEffect(() => {
    if (!socket) return;

    socket.on(ServerEvents.NEW_NOTIFICATION, handleNewNotification);
    socket.on(ServerEvents.NOTIFICATION_READ, handleNotificationRead);

    return () => {
      socket.off(ServerEvents.NEW_NOTIFICATION, handleNewNotification);
      socket.off(ServerEvents.NOTIFICATION_READ, handleNotificationRead);
    };
  }, [socket, handleNewNotification, handleNotificationRead]);

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
    // More methods will be added when we integrate with Redux state
  };
}
