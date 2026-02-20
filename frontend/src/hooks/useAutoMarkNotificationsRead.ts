/**
 * useAutoMarkNotificationsRead Hook
 *
 * Automatically marks notifications as read when user navigates to a channel or DM.
 * Subscribes to the notifications query so it re-runs when data arrives or updates,
 * including notifications that arrive while the user is already viewing the channel.
 */

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  notificationsControllerMarkAsReadMutation,
  notificationsControllerGetNotificationsOptions,
  notificationsControllerGetNotificationsQueryKey,
  notificationsControllerGetUnreadCountQueryKey,
} from '../api-client/@tanstack/react-query.gen';

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
      queryClient.invalidateQueries({ queryKey: notificationsControllerGetNotificationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: notificationsControllerGetUnreadCountQueryKey() });
    },
  });

  // Subscribe to notifications cache — effect re-runs when data arrives or updates
  const { data: notificationsData } = useQuery({
    ...notificationsControllerGetNotificationsOptions({ query: { limit: 50 } }),
    enabled: enabled && !!contextId,
  });

  const markAsReadRef = useRef(markAsRead);
  markAsReadRef.current = markAsRead;
  const processedIdsRef = useRef(new Set<string>());

  // Reset processed IDs when context changes (user navigated)
  useEffect(() => {
    processedIdsRef.current.clear();
  }, [contextId]);

  useEffect(() => {
    if (!enabled || !contextId || !notificationsData) return;

    const unread = notificationsData.notifications.filter((n) => {
      if (n.read || n.dismissed || processedIdsRef.current.has(n.id)) return false;
      return contextType === 'channel'
        ? n.channelId === contextId
        : n.directMessageGroupId === contextId;
    });

    if (unread.length === 0) return;

    unread.forEach((n) => processedIdsRef.current.add(n.id));

    logger.dev(
      `[Auto-mark] Marking ${unread.length} notification(s) as read for ${contextType}:${contextId}`
    );

    let isCancelled = false;

    (async () => {
      const results = await Promise.allSettled(
        unread.map((n) => markAsReadRef.current({ path: { id: n.id } }))
      );

      if (!isCancelled) {
        let failureCount = 0;
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            failureCount += 1;
            // Remove failed IDs so they can be retried on the next effect run
            processedIdsRef.current.delete(unread[index].id);
          }
        });
        if (failureCount > 0) {
          logger.error(`[Auto-mark] Failed: ${failureCount}/${unread.length}`);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [contextType, contextId, enabled, notificationsData]);
}

export default useAutoMarkNotificationsRead;
