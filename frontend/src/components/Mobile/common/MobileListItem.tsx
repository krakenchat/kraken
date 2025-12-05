/**
 * MobileListItem Component
 *
 * Touch-friendly list item with proper hit areas.
 * Supports swipe actions, long press, and accessibility.
 */

import React from 'react';
import {
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  ListItemIcon,
  Avatar,
  Box,
  IconButton,
} from '@mui/material';
import { TOUCH_TARGETS } from '../../../utils/breakpoints';

interface MobileListItemProps {
  // Content
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  // Avatar (optional)
  avatarSrc?: string;
  avatarIcon?: React.ReactNode;
  avatarFallback?: string;
  avatarColor?: string;
  // Icon (alternative to avatar)
  icon?: React.ReactNode;
  // Actions
  onClick?: () => void;
  onLongPress?: () => void;
  // Right side action
  action?: React.ReactNode;
  // State
  selected?: boolean;
  disabled?: boolean;
  // Style
  dense?: boolean;
}

/**
 * Touch-optimized list item with proper hit areas
 */
export const MobileListItem: React.FC<MobileListItemProps> = ({
  primary,
  secondary,
  avatarSrc,
  avatarIcon,
  avatarFallback,
  avatarColor,
  icon,
  onClick,
  onLongPress,
  action,
  selected = false,
  disabled = false,
  dense = false,
}) => {
  // Long press handling
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = React.useState(false);

  const handleTouchStart = () => {
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        setIsLongPressing(true);
        onLongPress();
        // Haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
      }, 500); // 500ms long press threshold
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  };

  const handleClick = () => {
    if (!isLongPressing && onClick) {
      onClick();
    }
  };

  const minHeight = dense ? TOUCH_TARGETS.MINIMUM : TOUCH_TARGETS.RECOMMENDED;

  return (
    <ListItem
      disablePadding
      secondaryAction={action}
    >
      <ListItemButton
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        selected={selected}
        disabled={disabled}
        sx={{
          minHeight,
          px: 2,
          py: dense ? 0.75 : 1,
          '&.Mui-selected': {
            backgroundColor: 'action.selected',
            '&:hover': {
              backgroundColor: 'action.selected',
            },
          },
        }}
      >
        {/* Avatar or Icon */}
        {(avatarSrc || avatarIcon || avatarFallback) && (
          <ListItemAvatar>
            <Avatar
              src={avatarSrc}
              sx={{
                bgcolor: avatarColor || 'primary.main',
                width: dense ? 36 : 40,
                height: dense ? 36 : 40,
              }}
            >
              {avatarIcon || avatarFallback?.charAt(0).toUpperCase()}
            </Avatar>
          </ListItemAvatar>
        )}

        {icon && !avatarSrc && !avatarIcon && !avatarFallback && (
          <ListItemIcon sx={{ minWidth: dense ? 36 : 40 }}>
            {icon}
          </ListItemIcon>
        )}

        {/* Text content */}
        <ListItemText
          primary={primary}
          secondary={secondary}
          primaryTypographyProps={{
            noWrap: true,
            fontWeight: selected ? 600 : 400,
            fontSize: dense ? '0.875rem' : '0.9375rem',
          }}
          secondaryTypographyProps={{
            noWrap: true,
            fontSize: dense ? '0.75rem' : '0.8125rem',
          }}
        />
      </ListItemButton>
    </ListItem>
  );
};

export default MobileListItem;
