import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import {
  Home as HomeIcon,
  Chat as ChatIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useMobileNavigation, type MobileTab } from './MobileNavigationContext';
import { LAYOUT_CONSTANTS } from '../../../utils/breakpoints';

/**
 * Discord-style bottom navigation with 4 tabs
 * Material Design 3 compliant bottom navigation bar
 */
export const MobileBottomNavigation: React.FC = () => {
  const { activeTab, setActiveTab } = useMobileNavigation();

  const handleChange = (_event: React.SyntheticEvent, newValue: MobileTab) => {
    setActiveTab(newValue);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <BottomNavigation
        value={activeTab}
        onChange={handleChange}
        showLabels
        sx={{
          height: LAYOUT_CONSTANTS.BOTTOM_NAV_HEIGHT_MOBILE,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 12px 8px',
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.75rem',
            fontWeight: 500,
            '&.Mui-selected': {
              fontSize: '0.75rem',
            },
          },
        }}
      >
        <BottomNavigationAction
          label="Communities"
          value="communities"
          icon={<HomeIcon />}
        />
        <BottomNavigationAction
          label="Messages"
          value="messages"
          icon={<ChatIcon />}
        />
        <BottomNavigationAction
          label="Notifications"
          value="notifications"
          icon={<NotificationsIcon />}
        />
        <BottomNavigationAction
          label="Profile"
          value="profile"
          icon={<PersonIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
};
