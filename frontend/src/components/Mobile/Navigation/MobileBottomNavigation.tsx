/**
 * MobileBottomNavigation Component
 *
 * Discord-style bottom navigation with 4 tabs.
 * Integrates with screen-based navigation for clean tab switching.
 */

import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper, Badge } from '@mui/material';
import {
  Home as HomeIcon,
  Chat as ChatIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useMobileNavigation, type MobileTab } from './MobileNavigationContext';
import { LAYOUT_CONSTANTS, TOUCH_TARGETS } from '../../../utils/breakpoints';

/**
 * Bottom navigation bar with 4 tabs:
 * - Home: Communities and channels
 * - Messages: Direct messages
 * - Notifications: Mentions and activity
 * - Profile: User settings
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
        // Safe area padding for devices with home indicator
        paddingBottom: 'env(safe-area-inset-bottom)',
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
            minHeight: TOUCH_TARGETS.MINIMUM,
            padding: '6px 12px 8px',
            gap: '4px',
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.6875rem',
            fontWeight: 500,
            marginTop: '2px',
            '&.Mui-selected': {
              fontSize: '0.6875rem',
              fontWeight: 600,
            },
          },
          '& .MuiSvgIcon-root': {
            fontSize: '1.375rem',
          },
        }}
      >
        <BottomNavigationAction
          label="Home"
          value="home"
          icon={<HomeIcon />}
        />
        <BottomNavigationAction
          label="Messages"
          value="messages"
          icon={
            <Badge badgeContent={0} color="error">
              <ChatIcon />
            </Badge>
          }
        />
        <BottomNavigationAction
          label="Notifications"
          value="notifications"
          icon={
            <Badge badgeContent={0} color="error">
              <NotificationsIcon />
            </Badge>
          }
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
