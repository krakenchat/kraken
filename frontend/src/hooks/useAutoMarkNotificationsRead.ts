/**
 * useAutoMarkNotificationsRead Hook
 *
 * Automatically marks notifications as read when user navigates to a channel or DM.
 * Marks all unread notifications for the current context (channel/DM).
 */

import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  notificationsControllerMarkAsReadMutation,
  notificationsControllerGetNotificationsQueryKey,
} from '../api-client/@tanstack/react-query.gen';
import type { NotificationListResponseDto } from '../api-client';

import { logger } from '../utils/logger';

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

  const queryClient = useQueryClient();

  const { mutateAsync: markAsRead } = useMutation({
    ...notificationsControllerMarkAsReadMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'notificationsControllerGetNotifications' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'notificationsControllerGetUnreadCount' }] });
    },
  });

  // Wrap in ref to stabilize for useEffect
  const markAsReadRef = useRef(markAsRead);
  markAsReadRef.current = markAsRead;

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

    // Read unread notifications from existing cache (snapshot, no separate fetch).
    // Uses getQueriesData to find any cached data regardless of query params.
    const queries = queryClient.getQueriesData<NotificationListResponseDto>({
      queryKey: notificationsControllerGetNotificationsQueryKey(),
    });

    let unreadNotifications: NotificationListResponseDto['notifications'] = [];
    for (const [, data] of queries) {
      if (data?.notifications) {
        unreadNotifications = data.notifications.filter((n) => !n.read && !n.dismissed);
        break;
      }
    }

    // Find all unread notifications for this context
    const notificationsToMark = unreadNotifications.filter((notification) => {
      if (contextType === 'channel') {
        return notification.channelId === contextId;
      } else {
        return notification.directMessageGroupId === contextId;
      }
    });

    // Update ref to prevent re-processing
    lastProcessedContextRef.current = contextId;

    // Mark each notification as read
    if (notificationsToMark.length > 0) {
      logger.dev(
        `[Auto-mark] Marking ${notificationsToMark.length} notification(s) as read for ${contextType}:${contextId}`
      );

      // Track if effect is still active (for cleanup)
      let isCancelled = false;

      // Mark all as read in parallel with proper error handling
      (async () => {
        try {
          const results = await Promise.allSettled(
            notificationsToMark.map((notification) =>
              markAsReadRef.current({ path: { id: notification.id } })
            )
          );

          // Only log if not cancelled (component still mounted)
          if (!isCancelled) {
            const failures = results.filter((r) => r.status === 'rejected');
            if (failures.length > 0) {
              logger.error(
                `[Auto-mark] Failed to mark ${failures.length}/${notificationsToMark.length} notification(s) as read:`,
                failures.map((f) => (f as PromiseRejectedResult).reason)
              );
            }
          }
        } catch (error) {
          // Unexpected error in Promise.allSettled itself (should not happen)
          if (!isCancelled) {
            logger.error('[Auto-mark] Unexpected error marking notifications as read:', error);
          }
        }
      })();

      // Cleanup: prevent state updates if navigated away
      return () => {
        isCancelled = true;
      };
    }
  }, [contextType, contextId, enabled, queryClient]);
}

export default useAutoMarkNotificationsRead;
