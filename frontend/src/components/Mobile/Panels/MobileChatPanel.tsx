/**
 * MobileChatPanel Component
 *
 * Chat view for channels and DMs.
 * Uses the new screen-based navigation with MobileAppBar.
 */

import React from 'react';
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  People as PeopleIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useGetChannelByIdQuery } from '../../../features/channel/channelApiSlice';
import { useGetDmGroupQuery } from '../../../features/directMessages/directMessagesApiSlice';
import { useMobileNavigation } from '../Navigation/MobileNavigationContext';
import { ChannelType } from '../../../types/channel.type';
import ChannelMessageContainer from '../../Channel/ChannelMessageContainer';
import { VideoTiles } from '../../Voice/VideoTiles';
import { VoiceChannelJoinButton } from '../../Voice/VoiceChannelJoinButton';
import { useVoiceConnection } from '../../../hooks/useVoiceConnection';
import { ErrorBoundary } from '../../ErrorBoundary';
import MobileAppBar from '../MobileAppBar';

interface MobileChatPanelProps {
  communityId?: string;
  channelId?: string;
  dmGroupId?: string;
}

/**
 * Chat panel - Shows messages for a selected channel or DM
 * Detail screen that slides in from the right
 */
export const MobileChatPanel: React.FC<MobileChatPanelProps> = ({
  channelId,
  dmGroupId,
}) => {
  const { goBack } = useMobileNavigation();
  const { state: voiceState } = useVoiceConnection();

  // Fetch channel or DM data
  const { data: channel } = useGetChannelByIdQuery(channelId || '', {
    skip: !channelId,
  });
  const { data: dmGroup } = useGetDmGroupQuery(dmGroupId || '', {
    skip: !dmGroupId,
  });

  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [showMemberDrawer, setShowMemberDrawer] = React.useState(false);

  const isVoiceChannel = channel?.type === ChannelType.VOICE;
  const isConnectedToThisChannel =
    voiceState.isConnected && voiceState.currentChannelId === channelId;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleShowMembers = () => {
    setShowMemberDrawer(true);
    handleMenuClose();
  };

  const handleChannelSettings = () => {
    // TODO: Navigate to channel settings
    handleMenuClose();
  };

  // Determine title
  let title = '';
  if (channel) {
    const prefix = channel.type === ChannelType.VOICE ? '🔊 ' : '# ';
    title = `${prefix}${channel.name}`;
  } else if (dmGroup) {
    title = dmGroup.name || 'Direct Message';
  }

  // Render content based on channel type
  const renderContent = () => {
    if (isVoiceChannel) {
      if (isConnectedToThisChannel) {
        return (
          <Box sx={{ height: '100%', width: '100%' }}>
            <ErrorBoundary>
              <VideoTiles />
            </ErrorBoundary>
          </Box>
        );
      }

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            px: 3,
            textAlign: 'center',
            gap: 3,
          }}
        >
          <Box sx={{ fontSize: 64 }}>🔊</Box>
          <Box>
            <Box sx={{ fontSize: '1.25rem', fontWeight: 600, mb: 1 }}>
              {channel?.name}
            </Box>
            <Box sx={{ color: 'text.secondary', mb: 3 }}>
              This is a voice channel. Join to start talking!
            </Box>
            {channel && <VoiceChannelJoinButton channel={channel} />}
          </Box>
        </Box>
      );
    }

    // Text channel or DM
    const contextId = channelId || dmGroupId || '';
    return <ChannelMessageContainer channelId={contextId} />;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* App bar with back button */}
      <MobileAppBar
        title={title}
        showBack
        onBack={goBack}
        showMembers={channel?.type === ChannelType.TEXT}
        onMembersClick={handleShowMembers}
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
            {channelId && (
              <MenuItem onClick={handleShowMembers}>
                <ListItemIcon>
                  <PeopleIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>View Members</ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={handleChannelSettings}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Channel Settings</ListItemText>
            </MenuItem>
          </Menu>
        }
      />

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {renderContent()}
      </Box>

      {/* TODO: Member drawer overlay */}
      {showMemberDrawer && (
        <Box
          onClick={() => setShowMemberDrawer(false)}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
          }}
        >
          {/* Member drawer content - implement later */}
        </Box>
      )}
    </Box>
  );
};
