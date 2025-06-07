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
  TextField,
  Autocomplete,
  Alert,
  CircularProgress,
  Chip,
  Avatar,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import {
  useGetMembersForCommunityQuery,
  useCreateMembershipMutation,
  useRemoveMembershipMutation,
} from "../../features/membership";
import { useUserPermissions } from "../../features/roles/useUserPermissions";
import { useLazySearchUsersQuery } from "../../features/users/usersSlice";

interface MemberManagementProps {
  communityId: string;
}

interface UserSearchOption {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const MemberManagement: React.FC<MemberManagementProps> = ({ communityId }) => {
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchOption | null>(null);
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearchOptions, setUserSearchOptions] = useState<UserSearchOption[]>([]);

  const {
    data: members,
    isLoading: loadingMembers,
    error: membersError,
  } = useGetMembersForCommunityQuery(communityId);

  const [createMembership, { isLoading: addingMember }] = useCreateMembershipMutation();
  const [removeMembership, { isLoading: removingMember }] = useRemoveMembershipMutation();
  const [searchUsers] = useLazySearchUsersQuery();

  const { hasPermissions: canCreateMembers } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["CREATE_MEMBER"],
  });

  const { hasPermissions: canDeleteMembers } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["DELETE_MEMBER"],
  });

  const canManageMembers = canCreateMembers || canDeleteMembers;

  const handleAddMember = async () => {
    if (!selectedUser) return;

    try {
      await createMembership({
        userId: selectedUser.id,
        communityId,
      }).unwrap();
      
      setAddMemberDialogOpen(false);
      setSelectedUser(null);
      setUserSearchInput("");
    } catch (error) {
      console.error("Failed to add member:", error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;

    try {
      await removeMembership({ userId, communityId }).unwrap();
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  };

  const handleUserSearch = async (searchValue: string) => {
    if (searchValue.length < 2) {
      setUserSearchOptions([]);
      return;
    }

    try {
      const users = await searchUsers({
        query: searchValue,
        communityId, // Filter out users already in this community
      }).unwrap();
      setUserSearchOptions(users);
    } catch (error) {
      console.error("Failed to search users:", error);
      setUserSearchOptions([]);
    }
  };

  if (loadingMembers) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (membersError) {
    return (
      <Alert severity="error">
        Failed to load members. Please try again.
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Community Members</Typography>
          {canManageMembers && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddMemberDialogOpen(true)}
            >
              Add Member
            </Button>
          )}
        </Box>

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
                <Avatar src={member.user?.avatarUrl || ""} />
                <Typography variant="body2">
                  {member.user?.displayName || member.user?.username}
                </Typography>
                <Chip label="Member" size="small" />
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
          ))}
        </Box>

        {/* Add Member Dialog */}
        <Dialog
          open={addMemberDialogOpen}
          onClose={() => setAddMemberDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add Member to Community</DialogTitle>
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
                  label="Search for user"
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

export default MemberManagement;
