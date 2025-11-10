/**
 * ChannelNotificationMenu Component
 *
 * Dropdown menu for managing per-channel notification overrides.
 * Allows users to set notification level for a specific channel.
 */

import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Notifications,
  NotificationsActive,
  NotificationsOff,
  NotificationsPaused,
  Check,
} from '@mui/icons-material';
import {
  useGetChannelOverrideQuery,
  useSetChannelOverrideMutation,
  useDeleteChannelOverrideMutation,
  useGetSettingsQuery,
} from '../../features/notifications/notificationsApiSlice';

interface ChannelNotificationMenuProps {
  channelId: string;
  channelName?: string;
}

type NotificationLevel = 'all' | 'mentions' | 'none' | 'default';

export const ChannelNotificationMenu: React.FC<ChannelNotificationMenuProps> = ({
  channelId,
  channelName,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const { data: override, isLoading: overrideLoading } = useGetChannelOverrideQuery(channelId);
  const { data: settings } = useGetSettingsQuery();
  const [setOverride, { isLoading: isSettingOverride }] = useSetChannelOverrideMutation();
  const [deleteOverride, { isLoading: isDeletingOverride }] = useDeleteChannelOverrideMutation();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSetLevel = async (level: NotificationLevel) => {
    try {
      if (level === 'default') {
        // Remove override to use default settings
        await deleteOverride(channelId).unwrap();
      } else {
        // Set specific override level
        await setOverride({ channelId, level }).unwrap();
      }
      handleClose();
    } catch (error) {
      console.error('Failed to update notification level:', error);
    }
  };

  // Determine current notification level
  const currentLevel: NotificationLevel = override?.level as NotificationLevel || 'default';
  const defaultLevel = settings?.defaultChannelLevel || 'mentions';

  // Get icon based on current level
  const getIcon = () => {
    const effectiveLevel = currentLevel === 'default' ? defaultLevel : currentLevel;
    switch (effectiveLevel) {
      case 'all':
        return <NotificationsActive />;
      case 'mentions':
        return <Notifications />;
      case 'none':
        return <NotificationsOff />;
      default:
        return <Notifications />;
    }
  };

  // Get tooltip text
  const getTooltipText = () => {
    const effectiveLevel = currentLevel === 'default' ? defaultLevel : currentLevel;
    const levelText = {
      all: 'All messages',
      mentions: 'Only @mentions',
      none: 'Nothing',
    }[effectiveLevel];

    return currentLevel === 'default'
      ? `Notifications: ${levelText} (default)`
      : `Notifications: ${levelText}`;
  };

  const isLoading = isSettingOverride || isDeletingOverride;

  return (
    <>
      <Tooltip title={getTooltipText()}>
        <IconButton
          onClick={handleClick}
          size="small"
          disabled={overrideLoading || isLoading}
        >
          {overrideLoading ? <CircularProgress size={20} /> : getIcon()}
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <ListItemText
            primary={`Notifications for ${channelName || 'this channel'}`}
            primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 'bold' }}
          />
        </MenuItem>
        <Divider />

        <MenuItem
          onClick={() => handleSetLevel('all')}
          selected={currentLevel === 'all'}
          disabled={isLoading}
        >
          <ListItemIcon>
            {currentLevel === 'all' ? <Check /> : <NotificationsActive />}
          </ListItemIcon>
          <ListItemText
            primary="All Messages"
            secondary="Every message in this channel"
          />
        </MenuItem>

        <MenuItem
          onClick={() => handleSetLevel('mentions')}
          selected={currentLevel === 'mentions'}
          disabled={isLoading}
        >
          <ListItemIcon>
            {currentLevel === 'mentions' ? <Check /> : <Notifications />}
          </ListItemIcon>
          <ListItemText
            primary="Only @mentions"
            secondary="When someone mentions you"
          />
        </MenuItem>

        <MenuItem
          onClick={() => handleSetLevel('none')}
          selected={currentLevel === 'none'}
          disabled={isLoading}
        >
          <ListItemIcon>
            {currentLevel === 'none' ? <Check /> : <NotificationsOff />}
          </ListItemIcon>
          <ListItemText
            primary="Nothing"
            secondary="No notifications from this channel"
          />
        </MenuItem>

        {currentLevel !== 'default' && (
          <>
            <Divider />
            <MenuItem
              onClick={() => handleSetLevel('default')}
              disabled={isLoading}
            >
              <ListItemIcon>
                <NotificationsPaused />
              </ListItemIcon>
              <ListItemText
                primary="Use Default"
                secondary={`Currently: ${defaultLevel}`}
              />
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};

export default ChannelNotificationMenu;
