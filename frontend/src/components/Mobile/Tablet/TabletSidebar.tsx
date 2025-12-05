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
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Avatar,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Tag as TagIcon,
  VolumeUp as VoiceIcon,
  Lock as LockIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useGetCommunityByIdQuery } from '../../../features/community/communityApiSlice';
import { useGetChannelsForCommunityQuery } from '../../../features/channel/channelApiSlice';
import { useMobileNavigation } from '../Navigation/MobileNavigationContext';
import { useAuthenticatedImage } from '../../../hooks/useAuthenticatedImage';
import { ChannelType } from '../../../types/channel.type';
import { LAYOUT_CONSTANTS, TOUCH_TARGETS } from '../../../utils/breakpoints';
import { useNavigate } from 'react-router-dom';
import { useCanPerformAction } from '../../../features/roles/useUserPermissions';

interface TabletSidebarProps {
  communityId: string;
}

/**
 * Tablet sidebar showing community info and channel list
 */
export const TabletSidebar: React.FC<TabletSidebarProps> = ({ communityId }) => {
  const navigate = useNavigate();
  const { state, navigateToChat, openDrawer } = useMobileNavigation();
  const { data: community } = useGetCommunityByIdQuery(communityId);
  const { data: channels = [] } = useGetChannelsForCommunityQuery(communityId);
  const { blobUrl: avatarUrl } = useAuthenticatedImage(community?.avatar);
  const canEditCommunity = useCanPerformAction('COMMUNITY', communityId, 'UPDATE_COMMUNITY');

  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    new Set(['Text Channels', 'Voice Channels'])
  );

  // Group channels by type
  const textChannels = channels.filter((ch) => ch.type === ChannelType.TEXT);
  const voiceChannels = channels.filter((ch) => ch.type === ChannelType.VOICE);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

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
        <List disablePadding>
          {/* Text Channels */}
          {textChannels.length > 0 && (
            <>
              <ListItem
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => toggleCategory('Text Channels')}
                  >
                    {expandedCategories.has('Text Channels') ? (
                      <ExpandLess fontSize="small" />
                    ) : (
                      <ExpandMore fontSize="small" />
                    )}
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => toggleCategory('Text Channels')}
                  sx={{ py: 0.5 }}
                >
                  <ListItemText
                    primary="TEXT CHANNELS"
                    primaryTypographyProps={{
                      variant: 'caption',
                      fontWeight: 700,
                      color: 'text.secondary',
                      fontSize: '0.6875rem',
                    }}
                  />
                </ListItemButton>
              </ListItem>

              <Collapse in={expandedCategories.has('Text Channels')} timeout="auto">
                <List component="div" disablePadding>
                  {textChannels.map((channel) => (
                    <ListItem key={channel.id} disablePadding>
                      <ListItemButton
                        selected={state.channelId === channel.id}
                        onClick={() => handleChannelClick(channel.id)}
                        sx={{
                          pl: 2,
                          py: 0.75,
                          minHeight: TOUCH_TARGETS.MINIMUM,
                          '&.Mui-selected': {
                            backgroundColor: 'action.selected',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <TagIcon sx={{ fontSize: '1.125rem' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={channel.name}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                            fontWeight: state.channelId === channel.id ? 600 : 400,
                            noWrap: true,
                          }}
                        />
                        {channel.isPrivate && (
                          <LockIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', ml: 0.5 }} />
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </>
          )}

          {/* Voice Channels */}
          {voiceChannels.length > 0 && (
            <>
              <ListItem
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => toggleCategory('Voice Channels')}
                  >
                    {expandedCategories.has('Voice Channels') ? (
                      <ExpandLess fontSize="small" />
                    ) : (
                      <ExpandMore fontSize="small" />
                    )}
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => toggleCategory('Voice Channels')}
                  sx={{ py: 0.5 }}
                >
                  <ListItemText
                    primary="VOICE CHANNELS"
                    primaryTypographyProps={{
                      variant: 'caption',
                      fontWeight: 700,
                      color: 'text.secondary',
                      fontSize: '0.6875rem',
                    }}
                  />
                </ListItemButton>
              </ListItem>

              <Collapse in={expandedCategories.has('Voice Channels')} timeout="auto">
                <List component="div" disablePadding>
                  {voiceChannels.map((channel) => (
                    <ListItem key={channel.id} disablePadding>
                      <ListItemButton
                        selected={state.channelId === channel.id}
                        onClick={() => handleChannelClick(channel.id)}
                        sx={{
                          pl: 2,
                          py: 0.75,
                          minHeight: TOUCH_TARGETS.MINIMUM,
                          '&.Mui-selected': {
                            backgroundColor: 'action.selected',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <VoiceIcon sx={{ fontSize: '1.125rem' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={channel.name}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                            fontWeight: state.channelId === channel.id ? 600 : 400,
                            noWrap: true,
                          }}
                        />
                        {channel.isPrivate && (
                          <LockIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', ml: 0.5 }} />
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </>
          )}

          {/* Empty state */}
          {channels.length === 0 && (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No channels yet
              </Typography>
            </Box>
          )}
        </List>
      </Box>
    </Box>
  );
};

export default TabletSidebar;
