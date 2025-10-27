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
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon,
  ExpandLess,
  ExpandMore,
  Tag as TagIcon,
  VolumeUp as VoiceIcon,
  Lock as LockIcon,
  Settings as SettingsIcon,
  ExitToApp as LeaveIcon,
} from '@mui/icons-material';
import { useGetCommunityByIdQuery } from '../../../features/community/communityApiSlice';
import { useGetChannelsForCommunityQuery } from '../../../features/channel/channelApiSlice';
import { useMobileNavigation } from '../Navigation/MobileNavigationContext';
import { ChannelType } from '../../../types/channel.type';
import { LAYOUT_CONSTANTS } from '../../../utils/breakpoints';
import { useNavigate } from 'react-router-dom';
import { useCanPerformAction } from '../../../features/roles/useUserPermissions';

interface MobileChannelsPanelProps {
  communityId: string;
}

/**
 * Channels panel - Shows channels for a selected community
 * Second panel in the Communities tab
 */
export const MobileChannelsPanel: React.FC<MobileChannelsPanelProps> = ({
  communityId,
}) => {
  const navigate = useNavigate();
  const { pushPanel, popPanel } = useMobileNavigation();
  const { data: community } = useGetCommunityByIdQuery(communityId);
  const { data: channels = [] } = useGetChannelsForCommunityQuery(communityId);
  const canEditCommunity = useCanPerformAction('COMMUNITY', communityId, 'UPDATE_COMMUNITY');

  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    new Set(['Text Channels', 'Voice Channels'])
  );
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

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
    pushPanel({
      type: 'chat',
      communityId,
      channelId,
    });
  };

  const handleBack = () => {
    popPanel();
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
      {/* App bar */}
      <AppBar
        position="sticky"
        elevation={1}
        sx={{ backgroundColor: 'background.paper' }}
      >
        <Toolbar sx={{ minHeight: LAYOUT_CONSTANTS.APPBAR_HEIGHT_MOBILE }}>
          <IconButton edge="start" color="inherit" onClick={handleBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>

          <Typography
            variant="h6"
            sx={{
              flex: 1,
              fontSize: '1.125rem',
              fontWeight: 600,
            }}
            noWrap
          >
            {community?.name || 'Community'}
          </Typography>

          <IconButton edge="end" color="inherit" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>

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
        </Toolbar>
      </AppBar>

      {/* Channel list */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <List>
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
                      <ExpandLess />
                    ) : (
                      <ExpandMore />
                    )}
                  </IconButton>
                }
              >
                <ListItemButton onClick={() => toggleCategory('Text Channels')}>
                  <ListItemText
                    primary="TEXT CHANNELS"
                    primaryTypographyProps={{
                      variant: 'caption',
                      fontWeight: 700,
                      color: 'text.secondary',
                    }}
                  />
                </ListItemButton>
              </ListItem>

              <Collapse in={expandedCategories.has('Text Channels')} timeout="auto">
                <List component="div" disablePadding>
                  {textChannels.map((channel) => (
                    <ListItem key={channel.id} disablePadding>
                      <ListItemButton
                        onClick={() => handleChannelClick(channel.id)}
                        sx={{ pl: 4, minHeight: LAYOUT_CONSTANTS.MIN_TOUCH_TARGET }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <TagIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={channel.name}
                          primaryTypographyProps={{
                            fontSize: '0.9375rem',
                            fontWeight: 500,
                          }}
                        />
                        {channel.isPrivate && (
                          <LockIcon fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
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
                      <ExpandLess />
                    ) : (
                      <ExpandMore />
                    )}
                  </IconButton>
                }
              >
                <ListItemButton onClick={() => toggleCategory('Voice Channels')}>
                  <ListItemText
                    primary="VOICE CHANNELS"
                    primaryTypographyProps={{
                      variant: 'caption',
                      fontWeight: 700,
                      color: 'text.secondary',
                    }}
                  />
                </ListItemButton>
              </ListItem>

              <Collapse in={expandedCategories.has('Voice Channels')} timeout="auto">
                <List component="div" disablePadding>
                  {voiceChannels.map((channel) => (
                    <ListItem key={channel.id} disablePadding>
                      <ListItemButton
                        onClick={() => handleChannelClick(channel.id)}
                        sx={{ pl: 4, minHeight: LAYOUT_CONSTANTS.MIN_TOUCH_TARGET }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <VoiceIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={channel.name}
                          primaryTypographyProps={{
                            fontSize: '0.9375rem',
                            fontWeight: 500,
                          }}
                        />
                        {channel.isPrivate && (
                          <LockIcon fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
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
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                py: 4,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No channels in this community
              </Typography>
            </Box>
          )}
        </List>
      </Box>
    </Box>
  );
};
