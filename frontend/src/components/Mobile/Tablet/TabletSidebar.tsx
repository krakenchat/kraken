/**
 * TabletSidebar Component
 *
 * Always-visible channel list for tablet split view.
 * Shows community name header and channel list.
 */

import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Avatar,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  communityControllerFindOneOptions,
  channelsControllerFindAllForCommunityOptions,
} from '../../../api-client/@tanstack/react-query.gen';
import { useMobileNavigation } from '../Navigation/MobileNavigationContext';
import { useAuthenticatedImage } from '../../../hooks/useAuthenticatedImage';
import { LAYOUT_CONSTANTS, TOUCH_TARGETS } from '../../../utils/breakpoints';
import { useNavigate } from 'react-router-dom';
import { useCanPerformAction } from '../../../features/roles/useUserPermissions';
import ChannelCategoryList from '../../Channel/ChannelCategoryList';

interface TabletSidebarProps {
  communityId: string;
}

/**
 * Tablet sidebar showing community info and channel list
 */
export const TabletSidebar: React.FC<TabletSidebarProps> = ({ communityId }) => {
  const navigate = useNavigate();
  const { state, navigateToChat, openDrawer } = useMobileNavigation();
  const { data: community } = useQuery(communityControllerFindOneOptions({ path: { id: communityId } }));
  const { data: channels = [] } = useQuery(channelsControllerFindAllForCommunityOptions({ path: { communityId } }));
  const { blobUrl: avatarUrl } = useAuthenticatedImage(community?.avatar);
  const canEditCommunity = useCanPerformAction('COMMUNITY', communityId, 'UPDATE_COMMUNITY');

  const handleChannelClick = (channelId: string) => {
    navigateToChat(communityId, channelId);
  };

  const handleSettingsClick = () => {
    navigate(`/community/${communityId}/edit`);
  };

  return (
    <Box
      sx={{
        width: LAYOUT_CONSTANTS.CHANNEL_LIST_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        flexShrink: 0,
      }}
    >
      {/* Community header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          gap: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: LAYOUT_CONSTANTS.APPBAR_HEIGHT_MOBILE,
        }}
      >
        <IconButton
          size="small"
          onClick={openDrawer}
          sx={{ mr: 0.5 }}
          aria-label="Switch community"
        >
          <MenuIcon />
        </IconButton>

        <Avatar
          src={avatarUrl || undefined}
          sx={{
            width: 32,
            height: 32,
            fontSize: '0.875rem',
          }}
        >
          {community?.name?.charAt(0).toUpperCase()}
        </Avatar>

        <Typography
          variant="subtitle1"
          fontWeight={600}
          noWrap
          sx={{ flex: 1 }}
        >
          {community?.name || 'Community'}
        </Typography>

        {canEditCommunity && (
          <IconButton
            size="small"
            onClick={handleSettingsClick}
            aria-label="Community settings"
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Channel list */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          pb: `${LAYOUT_CONSTANTS.BOTTOM_NAV_HEIGHT_MOBILE}px`,
        }}
      >
        <ChannelCategoryList
          channels={channels}
          onChannelSelect={handleChannelClick}
          selectedChannelId={state.channelId}
          compact
          touchTargetHeight={TOUCH_TARGETS.MINIMUM}
        />
      </Box>
    </Box>
  );
};

export default TabletSidebar;
