import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  IconButton,
  AppBar,
  Toolbar,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import {
  Add as AddIcon,
} from '@mui/icons-material';
import { useProfileQuery } from '../../../features/users/usersSlice';
import { useMyCommunitiesQuery } from '../../../features/community/communityApiSlice';
import { useAuthenticatedImage } from '../../../hooks/useAuthenticatedImage';
import { useMobileNavigation } from '../Navigation/MobileNavigationContext';
import { LAYOUT_CONSTANTS } from '../../../utils/breakpoints';
import { useNavigate } from 'react-router-dom';

/**
 * Communities panel - Shows list of user's communities
 * First panel in the Communities tab
 */
export const MobileCommunitiesPanel: React.FC = () => {
  const navigate = useNavigate();
  const { pushPanel } = useMobileNavigation();
  const { data: userData } = useProfileQuery();
  const { data: communities = [] } = useMyCommunitiesQuery();

  const handleCommunityClick = (communityId: string) => {
    pushPanel({
      type: 'channels',
      communityId,
    });
  };

  const handleCreateCommunity = () => {
    navigate('/community/create');
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
          <Typography
            variant="h6"
            sx={{
              flex: 1,
              fontSize: '1.125rem',
              fontWeight: 600,
            }}
          >
            Communities
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          pb: 2,
        }}
      >
        {/* Welcome card */}
        {userData && (
          <Card sx={{ mt: 2, mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  sx={{
                    width: 56,
                    height: 56,
                    fontSize: '1.5rem',
                  }}
                >
                  {userData.displayName?.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Welcome back, {userData.displayName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    @{userData.username}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Communities list */}
        <Box sx={{ mt: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              mb: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'text.secondary',
              }}
            >
              Your Communities ({communities.length})
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleCreateCommunity}
              sx={{ minWidth: 'auto' }}
            >
              Create
            </Button>
          </Box>

          {communities.length > 0 && (
            <List sx={{ pt: 0 }}>
              {communities.map((community) => (
                <CommunityListItem
                  key={community.id}
                  community={community}
                  onClick={() => handleCommunityClick(community.id)}
                />
              ))}
            </List>
          )}
        </Box>

        {/* Empty state */}
        {communities.length === 0 && (
          <Box sx={{ mt: 4, textAlign: 'center', px: 3 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No communities yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create or join a community to get started
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateCommunity}
            >
              Create Community
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// Community list item component
interface CommunityListItemProps {
  community: {
    id: string;
    name: string;
    avatar?: string | null;
    description?: string | null;
  };
  onClick: () => void;
}

const CommunityListItem: React.FC<CommunityListItemProps> = ({
  community,
  onClick,
}) => {
  const { blobUrl: avatarUrl } = useAuthenticatedImage(community.avatar);

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton onClick={onClick}>
          <ListItemAvatar>
            <Avatar src={avatarUrl || undefined} sx={{ width: 48, height: 48 }}>
              {community.name.charAt(0).toUpperCase()}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={community.name}
            secondary={community.description}
            primaryTypographyProps={{
              fontWeight: 600,
            }}
            secondaryTypographyProps={{
              noWrap: true,
            }}
          />
        </ListItemButton>
      </ListItem>
      <Divider variant="inset" component="li" />
    </>
  );
};
