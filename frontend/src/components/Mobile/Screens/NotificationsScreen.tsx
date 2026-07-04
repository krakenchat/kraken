/**
 * NotificationsScreen Component
 *
 * Mobile notifications tab — app bar + shared notification list.
 */

import React from 'react';
import { Box, Chip } from '@mui/material';

import MobileAppBar from '../MobileAppBar';
import { useNotifications } from '../../../hooks/useNotifications';
import { NotificationList } from '../../Notifications/NotificationList';

/**
 * Notifications screen - Shows list of notifications
 * Default screen for the Notifications tab
 */
export const NotificationsScreen: React.FC = () => {
  const { unreadCount } = useNotifications();

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MobileAppBar
        title="Notifications"
        actions={
          unreadCount > 0 && (
            <Chip
              label={unreadCount > 99 ? '99+' : unreadCount}
              size="small"
              color="primary"
              sx={{ mr: 1 }}
            />
          )
        }
      />
      <NotificationList />
    </Box>
  );
};

export default NotificationsScreen;
