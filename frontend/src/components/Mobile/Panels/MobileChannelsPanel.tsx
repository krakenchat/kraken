/**
 * MobileChannelsPanel Component
 *
 * Shows channels for a selected community.
 * Uses the new screen-based navigation.
 */

import React from 'react';
import {
  Box,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ExitToApp as LeaveIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  communityControllerFindOneOptions,
  channelsControllerFindAllForCommunityOptions,
} from '../../../api-client/@tanstack/react-query.gen';
import { useMobileNavigation } from '../Navigation/MobileNavigationContext';
import { TOUCH_TARGETS } from '../../../utils/breakpoints';
import { useNavigate } from 'react-router-dom';
import { useCanPerformAction } from '../../../features/roles/useUserPermissions';
import MobileAppBar from '../MobileAppBar';
import ChannelCategoryList from '../../Channel/ChannelCategoryList';

interface MobileChannelsPanelProps {
  communityId: string;
}

/**
 * Channels panel - Shows channels for a selected community
 * This is the default screen for the Home tab when a community is selected
 */
export const MobileChannelsPanel: React.FC<MobileChannelsPanelProps> = ({
  communityId,
}) => {
  const navigate = useNavigate();
  const { navigateToChat } = useMobileNavigation();
  const { data: community } = useQuery(communityControllerFindOneOptions({ path: { id: communityId } }));
  const { data: channels = [] } = useQuery(channelsControllerFindAllForCommunityOptions({ path: { communityId } }));
  const canEditCommunity = useCanPerformAction('COMMUNITY', communityId, 'UPDATE_COMMUNITY');

  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  const handleChannelClick = (channelId: string) => {
    navigateToChat(communityId, channelId);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEditCommunity = () => {
    navigate(`/community/${communityId}/edit`);
    handleMenuClose();
  };

  const handleLeaveCommunity = () => {
    // TODO: Implement leave community
    navigate('/');
    handleMenuClose();
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* App bar with community name and menu */}
      <MobileAppBar
        title={community?.name || 'Community'}
        showDrawerTrigger
        showMore
        onMoreClick={handleMenuOpen}
        actions={
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {canEditCommunity && (
              <MenuItem onClick={handleEditCommunity}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Community Settings</ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={handleLeaveCommunity}>
              <ListItemIcon>
                <LeaveIcon fontSize="small" sx={{ color: 'error.main' }} />
              </ListItemIcon>
              <ListItemText sx={{ color: 'error.main' }}>Leave Community</ListItemText>
            </MenuItem>
          </Menu>
        }
      />

      {/* Channel list */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <ChannelCategoryList
          channels={channels}
          onChannelSelect={handleChannelClick}
          touchTargetHeight={TOUCH_TARGETS.RECOMMENDED}
        />
      </Box>
    </Box>
  );
};
