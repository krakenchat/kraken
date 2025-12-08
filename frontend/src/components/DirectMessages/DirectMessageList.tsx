import React, { useState } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
} from "@mui/material";
import {
  Group as GroupIcon,
} from "@mui/icons-material";
import { useGetUserDmGroupsQuery, useCreateDmGroupMutation } from "../../features/directMessages/directMessagesApiSlice";
import { useProfileQuery } from "../../features/users/usersSlice";
import { DirectMessageGroup } from "../../types/direct-message.type";
import UserAvatar from "../Common/UserAvatar";
import UserSearchAutocomplete, { UserOption } from "../Common/UserSearchAutocomplete";
import EmptyState from "../Common/EmptyState";

interface DirectMessageListProps {
  selectedDmGroupId?: string;
  onSelectDmGroup: (dmGroupId: string) => void;
  showCreateDialog: boolean;
  setShowCreateDialog: (show: boolean) => void;
}

const DirectMessageList: React.FC<DirectMessageListProps> = ({
  selectedDmGroupId,
  onSelectDmGroup,
  showCreateDialog,
  setShowCreateDialog,
}) => {
  const { data: dmGroups = [], isLoading } = useGetUserDmGroupsQuery();
  const { data: currentUser } = useProfileQuery();
  const [createDmGroup, { isLoading: isCreating }] = useCreateDmGroupMutation();

  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [groupName, setGroupName] = useState("");

  const handleCreateDM = async () => {
    if (selectedUsers.length === 0) return;

    try {
      const isGroup = selectedUsers.length > 1;
      const result = await createDmGroup({
        userIds: selectedUsers.map(u => u.id),
        name: isGroup ? groupName || undefined : undefined,
        isGroup,
      }).unwrap();

      setShowCreateDialog(false);
      setSelectedUsers([]);
      setGroupName("");
      onSelectDmGroup(result.id);
    } catch (error) {
      console.error("Failed to create DM group:", error);
    }
  };

  const getDmDisplayName = (dmGroup: DirectMessageGroup): string => {
    if (dmGroup.name) return dmGroup.name;
    
    // For 1:1 DMs, show the other user's display name
    if (!dmGroup.isGroup && dmGroup.members.length === 2) {
      // Find the other user (not the current user)
      const otherMember = dmGroup.members.find(m => m.user.id !== currentUser?.id);
      return otherMember?.user.displayName || otherMember?.user.username || "Unknown User";
    }
    
    // For group DMs without a name, show member list (excluding current user)
    return dmGroup.members
      .filter(m => m.user.id !== currentUser?.id)
      .map(m => m.user.displayName || m.user.username)
      .join(", ");
  };

  const getDmUser = (dmGroup: DirectMessageGroup) => {
    if (!dmGroup.isGroup && dmGroup.members.length === 2) {
      const otherMember = dmGroup.members.find(m => m.user.id !== currentUser?.id);
      return otherMember?.user;
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
      return diffMinutes > 0 ? `${diffMinutes}m ago` : "Just now";
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <List>
          {dmGroups.map((dmGroup) => (
            <ListItem key={dmGroup.id} disablePadding>
              <ListItemButton
                selected={selectedDmGroupId === dmGroup.id}
                onClick={() => onSelectDmGroup(dmGroup.id)}
                sx={{
                  borderRadius: 1,
                  margin: "4px 0",
                  padding: "8px 16px",
                  minWidth: 0,
                  "&.Mui-selected": {
                    backgroundColor: "action.selected",
                  },
                }}
              >
              <ListItemAvatar>
                {dmGroup.isGroup ? (
                  <Avatar sx={{ bgcolor: "secondary.main" }}>
                    <GroupIcon />
                  </Avatar>
                ) : (
                  <UserAvatar user={getDmUser(dmGroup)} size="medium" />
                )}
              </ListItemAvatar>
              <ListItemText
                primary={getDmDisplayName(dmGroup)}
                secondary={
                  dmGroup.lastMessage ? (
                    <Box component="span" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", minWidth: 0 }}>
                      <Box 
                        component="span" 
                        sx={{ 
                          flex: 1, 
                          overflow: "hidden", 
                          textOverflow: "ellipsis", 
                          whiteSpace: "nowrap",
                          minWidth: 0
                        }}
                      >
                        {dmGroup.lastMessage.spans.find(s => s.type === "PLAINTEXT")?.text || "Message"}
                      </Box>
                      <Box 
                        component="span" 
                        sx={{ 
                          ml: 1, 
                          fontSize: "0.75rem",
                          flexShrink: 0,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {formatLastMessageTime(dmGroup.lastMessage.sentAt)}
                      </Box>
                    </Box>
                  ) : (
                    "No messages yet"
                  )
                }
                sx={{ minWidth: 0 }}
              />
              </ListItemButton>
            </ListItem>
          ))}
          {dmGroups.length === 0 && (
            <EmptyState
              variant="dm"
              action={{
                label: "Start a conversation",
                onClick: () => setShowCreateDialog(true),
              }}
            />
          )}
        </List>
      </Box>

      {/* Create DM Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start a Direct Message</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <UserSearchAutocomplete
              multiple
              value={selectedUsers}
              onChange={(value) => setSelectedUsers(value as UserOption[])}
              label="Select users"
              placeholder="Type to search users..."
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
            {isCreating ? <CircularProgress size={20} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DirectMessageList;