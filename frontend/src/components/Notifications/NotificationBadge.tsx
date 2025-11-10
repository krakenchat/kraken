/**
 * NotificationBadge Component
 *
 * Displays a badge icon with unread notification count in the app bar.
 * Opens the NotificationCenter drawer when clicked.
 */

import React from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAppSelector } from '../../app/hooks';
import { selectUnreadCount } from '../../features/notifications/notificationsSlice';

interface NotificationBadgeProps {
  onClick: () => void;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ onClick }) => {
  const unreadCount = useAppSelector(selectUnreadCount);

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
