import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  notificationsControllerGetNotificationsOptions,
  notificationsControllerGetNotificationsQueryKey,
  notificationsControllerGetUnreadCountQueryKey,
  notificationsControllerMarkAsReadMutation,
  notificationsControllerMarkAllAsReadMutation,
} from '../api-client/@tanstack/react-query.gen';
import { logger } from '../utils/logger';

const invalidateNotifications = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: notificationsControllerGetNotificationsQueryKey() });
  queryClient.invalidateQueries({ queryKey: notificationsControllerGetUnreadCountQueryKey() });
};

export function useNotifications() {
  const queryClient = useQueryClient();

  const {
    data: notificationsData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    notificationsControllerGetNotificationsOptions({ query: { limit: 50, unreadOnly: false } })
  );

  const { mutateAsync: markAsRead } = useMutation({
    ...notificationsControllerMarkAsReadMutation(),
    onSuccess: () => invalidateNotifications(queryClient),
  });

  const { mutateAsync: markAllAsRead, isPending: isMarkingAllRead } = useMutation({
    ...notificationsControllerMarkAllAsReadMutation(),
    onSuccess: () => invalidateNotifications(queryClient),
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;
  const hasUnread = notifications.some((n) => !n.read);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead({ path: { id: notificationId } });
    } catch (err) {
      logger.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead({});
    } catch (err) {
      logger.error('Failed to mark all as read:', err);
    }
  };

  return {
    notifications,
    unreadCount,
    hasUnread,
    isLoading,
    isMarkingAllRead,
    error,
    refetch,
    handleMarkAsRead,
    handleMarkAllAsRead,
    invalidateNotifications: () => invalidateNotifications(queryClient),
  };
}
