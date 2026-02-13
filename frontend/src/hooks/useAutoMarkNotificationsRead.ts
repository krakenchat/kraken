/**
 * useAutoMarkNotificationsRead Hook
 *
 * Automatically marks notifications as read when user navigates to a channel or DM.
 * Marks all unread notifications for the current context (channel/DM).
 */

import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  notificationsControllerMarkAsReadMutation,
  notificationsControllerGetNotificationsOptions,
} from '../api-client/@tanstack/react-query.gen';
import { invalidateByIds, INVALIDATION_GROUPS } from '../utils/queryInvalidation';
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

  const { data: notificationsData } = useQuery(
    notificationsControllerGetNotificationsOptions()
  );

  // Filter unread notifications client-side
  const unreadNotifications = useMemo(
    () => notificationsData?.notifications.filter(
      (n) => !n.read && !n.dismissed
    ) ?? [],
    [notificationsData]
  );

  const { mutateAsync: markAsRead } = useMutation({
    ...notificationsControllerMarkAsReadMutation(),
    onSuccess: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.notifications),
  });

  // Wrap in useCallback to stabilize for useEffect deps
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
      logger.dev(
        `[Auto-mark] Marking ${notificationsToMark.length} notification(s) as read for ${contextType}:${contextId}`
      );

      // Update ref to prevent re-processing
      lastProcessedContextRef.current = contextId;

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
    } else {
      // Update ref even if no notifications to mark
      lastProcessedContextRef.current = contextId;
    }
  }, [contextType, contextId, enabled, unreadNotifications]);
}

export default useAutoMarkNotificationsRead;
