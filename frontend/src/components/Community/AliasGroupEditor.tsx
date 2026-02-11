import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Paper,
} from "@mui/material";
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { membershipControllerFindAllForCommunityOptions } from "../../api-client/@tanstack/react-query.gen";
import {
  aliasGroupsControllerGetAliasGroupOptions,
  aliasGroupsControllerCreateAliasGroupMutation,
  aliasGroupsControllerUpdateAliasGroupMutation,
  aliasGroupsControllerUpdateMembersMutation,
} from "../../api-client/@tanstack/react-query.gen";
import { invalidateByIds, INVALIDATION_GROUPS } from "../../utils/queryInvalidation";
interface AliasGroupSummary {
  id: string;
  name: string;
  memberCount: number;
}
import UserAvatar from "../Common/UserAvatar";

interface AliasGroupEditorProps {
  communityId: string;
  group?: AliasGroupSummary;
  onComplete: () => void;
  onCancel: () => void;
}

const AliasGroupEditor: React.FC<AliasGroupEditorProps> = ({
  communityId,
  group,
  onComplete,
  onCancel,
}) => {
  const [name, setName] = useState(group?.name || "");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [nameError, setNameError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const isEditing = Boolean(group);

  // Fetch community members for selection
  const {
    data: members,
    isLoading: loadingMembers,
  } = useQuery(membershipControllerFindAllForCommunityOptions({ path: { communityId } }));

  const queryClient = useQueryClient();

  // Fetch full group details when editing to get current members
  const {
    data: groupDetails,
    isLoading: loadingGroupDetails,
  } = useQuery({
    ...aliasGroupsControllerGetAliasGroupOptions({ path: { groupId: group?.id || "" } }),
    enabled: !!group?.id,
  });

  // Mutations
  const { mutateAsync: createGroup, isPending: creatingGroup, error: createError } = useMutation({
    ...aliasGroupsControllerCreateAliasGroupMutation(),
    onSuccess: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.aliasGroups),
  });

  const { mutateAsync: updateGroup, isPending: updatingGroup, error: updateError } = useMutation({
    ...aliasGroupsControllerUpdateAliasGroupMutation(),
    onSuccess: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.aliasGroups),
  });

  const { mutateAsync: updateMembers, isPending: updatingMembers, error: membersError } = useMutation({
    ...aliasGroupsControllerUpdateMembersMutation(),
    onSuccess: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.aliasGroups),
  });

  // Initialize selected members when editing
  useEffect(() => {
    if (groupDetails?.members) {
      setSelectedMemberIds(new Set(groupDetails.members.map(m => m.id)));
    }
  }, [groupDetails]);

  const isLoading = creatingGroup || updatingGroup || updatingMembers;
  const error = createError || updateError || membersError;

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!searchQuery.trim()) return members;

    const query = searchQuery.toLowerCase();
    return members.filter(member => {
      const username = member.user?.username?.toLowerCase() || "";
      const displayName = member.user?.displayName?.toLowerCase() || "";
      return username.includes(query) || displayName.includes(query);
    });
  }, [members, searchQuery]);

  const validateName = (value: string): boolean => {
    if (value.trim().length === 0) {
      setNameError("Group name is required");
      return false;
    }
    if (value.length > 50) {
      setNameError("Group name must not exceed 50 characters");
      return false;
    }
    // Only allow alphanumeric, hyphens, and underscores for mention compatibility
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setNameError("Group name can only contain letters, numbers, hyphens, and underscores");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    setName(newName);
    validateName(newName);
  };

  const handleMemberToggle = useCallback((userId: string) => {
    setSelectedMemberIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (filteredMembers.length > 0) {
      const allSelected = filteredMembers.every(m => selectedMemberIds.has(m.userId));
      if (allSelected) {
        // Deselect all filtered members
        setSelectedMemberIds(prev => {
          const newSet = new Set(prev);
          filteredMembers.forEach(m => newSet.delete(m.userId));
          return newSet;
        });
      } else {
        // Select all filtered members
        setSelectedMemberIds(prev => {
          const newSet = new Set(prev);
          filteredMembers.forEach(m => newSet.add(m.userId));
          return newSet;
        });
      }
    }
  }, [filteredMembers, selectedMemberIds]);

  const handleSave = async () => {
    if (!validateName(name)) {
      return;
    }

    try {
      if (isEditing && group) {
        // Update existing group - update name if changed, then update members
        if (name.trim() !== group.name) {
          await updateGroup({
            path: { groupId: group.id },
            body: { name: name.trim() },
          });
        }

        // Update members
        await updateMembers({
          path: { groupId: group.id },
          body: { memberIds: Array.from(selectedMemberIds) },
        });
      } else {
        // Create new group with members
        await createGroup({
          path: { communityId },
          body: {
            name: name.trim(),
            memberIds: Array.from(selectedMemberIds),
          },
        });
      }

      onComplete();
    } catch {
      // Error handled by RTK Query
    }
  };

  const isFormValid = name.trim().length > 0 && !nameError;
  const allFilteredSelected = filteredMembers.length > 0 &&
    filteredMembers.every(m => selectedMemberIds.has(m.userId));

  const getErrorMessage = (error: unknown): string => {
    if (!error) return "";
    const err = error as { data?: { message?: string } };
    return err?.data?.message || "An error occurred";
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            {isEditing ? `Edit Group: @${group?.name}` : "Create Mention Group"}
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              onClick={onCancel}
              startIcon={<CancelIcon />}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              startIcon={isLoading ? <CircularProgress size={16} /> : <SaveIcon />}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? "Saving..." : (isEditing ? "Save Changes" : "Create Group")}
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {getErrorMessage(error)}
          </Alert>
        )}

        {/* Group Name */}
        <Box mb={4}>
          <TextField
            label="Group Name"
            value={name}
            onChange={handleNameChange}
            fullWidth
            error={Boolean(nameError)}
            helperText={nameError || "This name will be used for @mentions (e.g., @designers)"}
            disabled={isLoading}
            inputProps={{ maxLength: 50 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">@</InputAdornment>
              ),
            }}
          />
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Member Selection */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Members
          </Typography>
          <Chip
            label={`${selectedMemberIds.size} selected`}
            color={selectedMemberIds.size > 0 ? "primary" : "default"}
            size="small"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" mb={2}>
          Select the community members who should be notified when this group is mentioned.
        </Typography>

        {/* Search */}
        <TextField
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />

        {/* Select All Button */}
        {filteredMembers.length > 0 && (
          <Box mb={1}>
            <Button
              size="small"
              onClick={handleSelectAll}
              disabled={isLoading}
            >
              {allFilteredSelected ? "Deselect All" : "Select All"}
              {searchQuery && ` (${filteredMembers.length} shown)`}
            </Button>
          </Box>
        )}

        {/* Member List */}
        {loadingMembers || loadingGroupDetails ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : filteredMembers.length > 0 ? (
          <Paper variant="outlined" sx={{ maxHeight: 400, overflow: "auto" }}>
            <List dense disablePadding>
              {filteredMembers.map((member) => {
                const isSelected = selectedMemberIds.has(member.userId);
                return (
                  <ListItem
                    key={member.id}
                    disablePadding
                    divider
                  >
                    <ListItemButton
                      onClick={() => handleMemberToggle(member.userId)}
                      disabled={isLoading}
                      selected={isSelected}
                    >
                      <ListItemIcon sx={{ minWidth: 42 }}>
                        <Checkbox
                          edge="start"
                          checked={isSelected}
                          tabIndex={-1}
                          disableRipple
                          disabled={isLoading}
                        />
                      </ListItemIcon>
                      <ListItemIcon sx={{ minWidth: 48 }}>
                        <UserAvatar user={member.user} size="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={member.user?.username}
                        secondary={member.user?.displayName}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        ) : members?.length === 0 ? (
          <Alert severity="info">
            No members in this community yet. Add members to the community first.
          </Alert>
        ) : (
          <Alert severity="info">
            No members match your search.
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {isEditing
              ? "Changes will take effect immediately"
              : "The group will be available for mentions after creation"}
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? <CircularProgress size={20} /> : (isEditing ? "Save Changes" : "Create Group")}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AliasGroupEditor;
