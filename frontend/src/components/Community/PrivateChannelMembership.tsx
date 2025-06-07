import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import {
  useGetMembersForChannelQuery,
  useCreateChannelMembershipMutation,
  useRemoveChannelMembershipMutation,
} from "../../features/membership";
import { useLazySearchUsersQuery } from "../../features/users/usersSlice";
import { useUserPermissions } from "../../features/roles/useUserPermissions";
import type { Channel } from "../../types/channel.type";

interface PrivateChannelMembershipProps {
  channels: Channel[];
}

interface UserSearchOption {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const PrivateChannelMembership: React.FC<PrivateChannelMembershipProps> = ({ 
  channels 
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchOption | null>(null);
  const [selectedRole, setSelectedRole] = useState<"MEMBER" | "MODERATOR" | "ADMIN">("MEMBER");
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearchOptions, setUserSearchOptions] = useState<UserSearchOption[]>([]);

  // Filter to only private channels
  const privateChannels = channels.filter(channel => channel.isPrivate);
  const selectedChannel = privateChannels.find(ch => ch.id === selectedChannelId);

  const {
    data: members,
    isLoading: loadingMembers,
    error: membersError,
  } = useGetMembersForChannelQuery(selectedChannelId, {
    skip: !selectedChannelId,
  });

  const [createChannelMembership, { isLoading: addingMember }] = useCreateChannelMembershipMutation();
  const [removeChannelMembership, { isLoading: removingMember }] = useRemoveChannelMembershipMutation();
  const [searchUsers] = useLazySearchUsersQuery();

  const { hasPermissions: canCreateMembers } = useUserPermissions({
    resourceType: "CHANNEL",
    resourceId: selectedChannelId,
    actions: ["CREATE_MEMBER"],
  });

  const { hasPermissions: canDeleteMembers } = useUserPermissions({
    resourceType: "CHANNEL",
    resourceId: selectedChannelId,
    actions: ["DELETE_MEMBER"],
  });

  const canManageMembers = canCreateMembers || canDeleteMembers;

  const handleAddMember = async () => {
    if (!selectedUser || !selectedChannelId) return;

    try {
      await createChannelMembership({
        userId: selectedUser.id,
        channelId: selectedChannelId,
        role: selectedRole,
      }).unwrap();
      
      setAddMemberDialogOpen(false);
      setSelectedUser(null);
      setUserSearchInput("");
      setSelectedRole("MEMBER");
    } catch (error) {
      console.error("Failed to add member to channel:", error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedChannelId) return;
    if (!window.confirm("Are you sure you want to remove this member from the channel?")) return;

    try {
      await removeChannelMembership({ userId, channelId: selectedChannelId }).unwrap();
    } catch (error) {
      console.error("Failed to remove member from channel:", error);
    }
  };

  const handleUserSearch = async (searchValue: string) => {
    if (searchValue.length < 2) {
      setUserSearchOptions([]);
      return;
    }

    try {
      // For private channel membership, we want to search within community members only
      // So we don't pass communityId to filter them out, but rather want to search them
      const users = await searchUsers({
        query: searchValue,
        // No communityId filtering since we want community members for channel access
      }).unwrap();
      setUserSearchOptions(users);
    } catch (error) {
      console.error("Failed to search users:", error);
      setUserSearchOptions([]);
    }
  };

  const getRoleColor = (role: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (role) {
      case "ADMIN":
        return "error";
      case "MODERATOR":
        return "warning";
      default:
        return "default";
    }
  };

  if (privateChannels.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Private Channel Membership
          </Typography>
          <Alert severity="info">
            No private channels found. Create a private channel first to manage its membership.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Private Channel Membership</Typography>
        </Box>

        <FormControl fullWidth margin="normal">
          <InputLabel>Select Private Channel</InputLabel>
          <Select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            label="Select Private Channel"
          >
            {privateChannels.map((channel) => (
              <MenuItem key={channel.id} value={channel.id}>
                #{channel.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedChannelId && (
          <>
            <Box display="flex" justifyContent="space-between" alignItems="center" mt={3} mb={2}>
              <Typography variant="subtitle1">
                Members of #{selectedChannel?.name}
              </Typography>
              {canManageMembers && canCreateMembers && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setAddMemberDialogOpen(true)}
                >
                  Add Member
                </Button>
              )}
            </Box>

            {loadingMembers ? (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress />
              </Box>
            ) : membersError ? (
              <Alert severity="error">
                Failed to load channel members. Please try again.
              </Alert>
            ) : (
              <Box display="flex" flexDirection="column" gap={1}>
                {members?.map((member) => (
                  <Box
                    key={member.id}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    p={1}
                    border={1}
                    borderColor="divider"
                    borderRadius={1}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">
                        {member.user?.displayName || member.user?.username}
                      </Typography>
                      <Chip 
                        label={member.role} 
                        size="small" 
                        color={getRoleColor(member.role)}
                      />
                    </Box>
                    {canManageMembers && canDeleteMembers && (
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={removingMember}
                      >
                        Remove
                      </Button>
                    )}
                  </Box>
                )) || (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                    No members in this channel
                  </Typography>
                )}
              </Box>
            )}
          </>
        )}

        {/* Add Member Dialog */}
        <Dialog
          open={addMemberDialogOpen}
          onClose={() => setAddMemberDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add Member to #{selectedChannel?.name}</DialogTitle>
          <DialogContent>
            <Autocomplete
              options={userSearchOptions}
              getOptionLabel={(option) => option.username}
              value={selectedUser}
              onChange={(_, newValue) => setSelectedUser(newValue)}
              inputValue={userSearchInput}
              onInputChange={(_, newInputValue) => {
                setUserSearchInput(newInputValue);
                handleUserSearch(newInputValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search for community member"
                  placeholder="Type username to search"
                  fullWidth
                  margin="normal"
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Typography>{option.displayName || option.username}</Typography>
                </Box>
              )}
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Role</InputLabel>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as "MEMBER" | "MODERATOR" | "ADMIN")}
                label="Role"
              >
                <MenuItem value="MEMBER">Member</MenuItem>
                <MenuItem value="MODERATOR">Moderator</MenuItem>
                <MenuItem value="ADMIN">Admin</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddMemberDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddMember}
              variant="contained"
              disabled={!selectedUser || addingMember}
            >
              {addingMember ? <CircularProgress size={20} /> : "Add Member"}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PrivateChannelMembership;
