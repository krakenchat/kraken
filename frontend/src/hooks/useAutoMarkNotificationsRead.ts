/**
 * useAutoMarkNotificationsRead Hook
 *
 * Automatically marks notifications as read when user navigates to a channel or DM.
 * Marks all unread notifications for the current context (channel/DM).
 */

import { useEffect, useRef } from 'react';
import { useAppSelector } from '../app/hooks';
import {
  selectUnreadNotifications,
} from '../features/notifications/notificationsSlice';
import { useMarkAsReadMutation } from '../features/notifications/notificationsApiSlice';

interface UseAutoMarkNotificationsReadOptions {
  /**
   * Type of context being viewed
   */
  contextType: 'channel' | 'dm';

  /**
   * ID of the channel or DM group being viewed
   */
  contextId: string | undefined;

  /**
   * Whether to enable auto-marking (default: true)
   */
  enabled?: boolean;
}

/**
 * Hook to automatically mark notifications as read when viewing a channel/DM
 */
export function useAutoMarkNotificationsRead(options: UseAutoMarkNotificationsReadOptions) {
  const { contextType, contextId, enabled = true } = options;

  const unreadNotifications = useAppSelector(selectUnreadNotifications);
  const [markAsRead] = useMarkAsReadMutation();

  // Track the last processed contextId to avoid re-processing on notification changes
  const lastProcessedContextRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !contextId) {
      return;
    }

    // Only process if contextId has changed (i.e., user navigated to a different channel/DM)
    if (lastProcessedContextRef.current === contextId) {
      return;
    }

    // Find all unread notifications for this context
    const notificationsToMark = unreadNotifications.filter((notification) => {
      if (contextType === 'channel') {
        return notification.channelId === contextId && !notification.read;
      } else {
        return notification.directMessageGroupId === contextId && !notification.read;
      }
    });

    // Mark each notification as read
    if (notificationsToMark.length > 0) {
      console.log(
        `[Auto-mark] Marking ${notificationsToMark.length} notification(s) as read for ${contextType}:${contextId}`
      );

      // Update ref to prevent re-processing
      lastProcessedContextRef.current = contextId;

      // Mark all as read in parallel
      Promise.all(
        notificationsToMark.map((notification) =>
          markAsRead(notification.id).unwrap().catch((error) => {
            console.error(`Failed to mark notification ${notification.id} as read:`, error);
          })
        )
      );
    } else {
      // Update ref even if no notifications to mark
      lastProcessedContextRef.current = contextId;
    }
  }, [contextType, contextId, enabled, unreadNotifications, markAsRead]);
}

export default useAutoMarkNotificationsRead;
