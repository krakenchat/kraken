/**
 * MobileMessagesPanel Component
 *
 * Shows list of DM conversations.
 * Uses the new screen-based navigation with MobileAppBar.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Fab,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Group as GroupIcon,
  Person as PersonIconAvatar,
} from '@mui/icons-material';
import { useGetUserDmGroupsQuery, useCreateDmGroupMutation } from '../../../features/directMessages/directMessagesApiSlice';
import { useGetAllUsersQuery, useProfileQuery } from '../../../features/users/usersSlice';
import UserAvatar from '../../Common/UserAvatar';
import { useMobileNavigation } from '../Navigation/MobileNavigationContext';
import { LAYOUT_CONSTANTS, TOUCH_TARGETS } from '../../../utils/breakpoints';
import { DirectMessageGroup } from '../../../types/direct-message.type';
import MobileAppBar from '../MobileAppBar';

interface User {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

/**
 * Messages panel - Shows list of DM conversations
 * Default screen for the Messages tab
 */
export const MobileMessagesPanel: React.FC = () => {
  const { navigateToDmChat } = useMobileNavigation();
  const { data: dmGroups = [], isLoading } = useGetUserDmGroupsQuery();
  const { data: usersData } = useGetAllUsersQuery({ limit: 100 });
  const users = usersData?.users || [];
  const { data: currentUser } = useProfileQuery();
  const [createDmGroup, { isLoading: isCreating }] = useCreateDmGroupMutation();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');

  const handleDmClick = (dmGroupId: string) => {
    navigateToDmChat(dmGroupId);
  };

  const handleCreateDM = async () => {
    if (selectedUsers.length === 0) return;

    try {
      const isGroup = selectedUsers.length > 1;
      const result = await createDmGroup({
        userIds: selectedUsers.map((u) => u.id),
        name: isGroup ? groupName || undefined : undefined,
        isGroup,
      }).unwrap();

      setShowCreateDialog(false);
      setSelectedUsers([]);
      setGroupName('');
      handleDmClick(result.id);
    } catch (error) {
      console.error('Failed to create DM group:', error);
    }
  };

  const getDmDisplayName = (dmGroup: DirectMessageGroup): string => {
    if (dmGroup.name) return dmGroup.name;

    // For 1:1 DMs, show the other user's display name
    if (!dmGroup.isGroup && dmGroup.members.length === 2) {
      const otherMember = dmGroup.members.find((m) => m.user.id !== currentUser?.id);
      return otherMember?.user.displayName || otherMember?.user.username || 'Unknown User';
    }

    // For group DMs without a name, show member list (excluding current user)
    return dmGroup.members
      .filter((m) => m.user.id !== currentUser?.id)
      .map((m) => m.user.displayName || m.user.username)
      .join(', ');
  };

  const getDmAvatar = (dmGroup: DirectMessageGroup) => {
    if (!dmGroup.isGroup && dmGroup.members.length === 2) {
      const otherMember = dmGroup.members.find((m) => m.user.id !== currentUser?.id);
      return otherMember?.user.avatarUrl;
    }
    return null;
  };

  const formatLastMessageTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes > 0 ? `${diffMinutes}m ago` : 'Just now';
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* App bar */}
      <MobileAppBar title="Messages" />

      {/* DM list */}
      {isLoading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 1,
          }}
        >
          <List>
            {dmGroups.map((dmGroup) => (
              <ListItem key={dmGroup.id} disablePadding>
                <ListItemButton
                  onClick={() => handleDmClick(dmGroup.id)}
                  sx={{
                    borderRadius: 1,
                    margin: '4px 0',
                    padding: '8px 16px',
                    minHeight: TOUCH_TARGETS.RECOMMENDED,
                    minWidth: 0,
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={getDmAvatar(dmGroup) || undefined}
                      sx={{
                        bgcolor: dmGroup.isGroup ? 'secondary.main' : 'primary.main',
                        width: 48,
                        height: 48,
                      }}
                    >
                      {getDmAvatar(dmGroup) ? null : dmGroup.isGroup ? (
                        <GroupIcon />
                      ) : (
                        <PersonIconAvatar />
                      )}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={getDmDisplayName(dmGroup)}
                    secondary={
                      dmGroup.lastMessage ? (
                        <Box
                          component="span"
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            minWidth: 0,
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                            }}
                          >
                            {dmGroup.lastMessage.spans.find((s) => s.type === 'PLAINTEXT')
                              ?.text || 'Message'}
                          </Box>
                          <Box
                            component="span"
                            sx={{
                              ml: 1,
                              fontSize: '0.75rem',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatLastMessageTime(dmGroup.lastMessage.sentAt)}
                          </Box>
                        </Box>
                      ) : (
                        'No messages yet'
                      )
                    }
                    primaryTypographyProps={{
                      fontWeight: 600,
                    }}
                    sx={{ minWidth: 0 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {dmGroups.length === 0 && (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No messages yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start a conversation by tapping the + button
                </Typography>
              </Box>
            )}
          </List>
        </Box>
      )}

      {/* FAB for create DM */}
      <Fab
        color="primary"
        aria-label="start conversation"
        onClick={() => setShowCreateDialog(true)}
        sx={{
          position: 'fixed',
          bottom: LAYOUT_CONSTANTS.BOTTOM_NAV_HEIGHT_MOBILE + 16,
          right: 16,
        }}
      >
        <AddIcon />
      </Fab>

      {/* Create DM Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Start a Direct Message</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(user) => user.displayName || user.username}
              value={selectedUsers}
              onChange={(_, newValue) => setSelectedUsers(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select users"
                  placeholder="Type to search users..."
                  margin="normal"
                />
              )}
              renderTags={(tagValue, getTagProps) =>
                tagValue.map((user, index) => {

                  const { key: _key, ...chipProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={user.id}
                      label={user.displayName || user.username}
                      {...chipProps}
                      avatar={<UserAvatar user={user} size="small" />}
                    />
                  );
                })
              }
            />
          </Box>

          {selectedUsers.length > 1 && (
            <TextField
              fullWidth
              label="Group name (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter a name for your group..."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateDM}
            disabled={selectedUsers.length === 0 || isCreating}
            variant="contained"
          >
            {isCreating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
