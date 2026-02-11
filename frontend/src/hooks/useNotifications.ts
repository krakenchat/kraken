/**
 * useNotifications Hook
 *
 * Manages real-time notifications via WebSocket and displays browser/Electron notifications.
 * Integrates with Redux state for notification management.
 */

import { useEffect, useCallback, useRef } from 'react';
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
  getNotificationPermission,
} from '../utils/notifications';
import { useAppDispatch } from '../app/hooks';
import {
  addNotification,
  markNotificationAsRead as markAsReadAction,
  markNotificationAsShown,
} from '../features/notifications/notificationsSlice';
import { isElectron, getElectronAPI } from '../utils/platform';

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
    onNotificationReceived,
    onNotificationClick,
  } = options;

  const socket = useSocket();
  const dispatch = useAppDispatch();
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
      handleNotificationClicked,
    ]
  );

  /**
   * Handle notification read status update from WebSocket
   */
  const handleNotificationRead = useCallback(
    (payload: NotificationReadPayload) => {
      logger.dev('[Notifications] Notification marked as read:', payload);

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
