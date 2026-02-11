/**
 * NotificationBadge Component
 *
 * Displays a badge icon with unread notification count in the app bar.
 * Opens the NotificationCenter drawer when clicked.
 *
 * Uses RTK Query to fetch the unread count from the server and syncs
 * it to the Redux store for other components that may need it.
 */

import React, { useEffect } from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useQuery } from '@tanstack/react-query';
import { notificationsControllerGetUnreadCountOptions } from '../../api-client/@tanstack/react-query.gen';
import { useAppDispatch } from '../../app/hooks';
import { setUnreadCount } from '../../features/notifications/notificationsSlice';

interface NotificationBadgeProps {
  onClick: () => void;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ onClick }) => {
  const dispatch = useAppDispatch();

  // Fetch unread count from server, poll every 30 seconds
  const { data } = useQuery({
    ...notificationsControllerGetUnreadCountOptions(),
    refetchInterval: 30_000,
  });

  const unreadCount = data?.count ?? 0;

  // Sync the unread count to Redux for other components
  useEffect(() => {
    if (data?.count !== undefined) {
      dispatch(setUnreadCount(data.count));
    }
  }, [data?.count, dispatch]);

  return (
    <Tooltip title="Notifications">
      <IconButton
        color="inherit"
        onClick={onClick}
        aria-label={`${unreadCount} unread notifications`}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
};

export default NotificationBadge;
