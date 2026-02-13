/**
 * NotificationBadge Component
 *
 * Displays a badge icon with unread notification count in the app bar.
 * Opens the NotificationCenter drawer when clicked.
 *
 * Uses TanStack Query to fetch the unread count from the server.
 */

import React from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useQuery } from '@tanstack/react-query';
import { notificationsControllerGetUnreadCountOptions } from '../../api-client/@tanstack/react-query.gen';

interface NotificationBadgeProps {
  onClick: () => void;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ onClick }) => {
  // Fetch unread count from server, poll every 30 seconds
  const { data } = useQuery({
    ...notificationsControllerGetUnreadCountOptions(),
    refetchInterval: 30_000,
  });

  const unreadCount = data?.count ?? 0;

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
