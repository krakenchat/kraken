/**
 * CreateDmDialog Component
 *
 * Shared dialog for creating new DM conversations.
 * Used by both DirectMessageList (desktop) and MobileMessagesPanel (mobile).
 */

import React, { useState } from "react";
import {
  Box,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
} from "@mui/material";
import ResponsiveDialog from "../Common/ResponsiveDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { directMessagesControllerCreateDmGroupMutation } from "../../api-client/@tanstack/react-query.gen";
import { invalidateDmGroupQueries } from "../../utils/queryInvalidation";

import UserSearchAutocomplete, { UserOption } from "../Common/UserSearchAutocomplete";
import { logger } from "../../utils/logger";

interface CreateDmDialogProps {
  open: boolean;
  onClose: () => void;
  onDmCreated: (dmGroupId: string) => void;
}

const CreateDmDialog: React.FC<CreateDmDialogProps> = ({
  open,
  onClose,
  onDmCreated,
}) => {
  const queryClient = useQueryClient();
  const { mutateAsync: createDmGroup, isPending: isCreating } = useMutation({
    ...directMessagesControllerCreateDmGroupMutation(),
    onSuccess: () => invalidateDmGroupQueries(queryClient),
  });

  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [groupName, setGroupName] = useState("");

  const handleCreateDM = async () => {
    if (selectedUsers.length === 0) return;

    try {
      const isGroup = selectedUsers.length > 1;
      const result = await createDmGroup({
        body: {
          userIds: selectedUsers.map((u) => u.id),
          name: isGroup ? groupName || undefined : undefined,
          isGroup,
        },
      });

      setSelectedUsers([]);
      setGroupName("");
      onClose();
      onDmCreated(result.id);
    } catch (error) {
      logger.error("Failed to create DM group:", error);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <ResponsiveDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth title="Start a Direct Message">
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
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleCreateDM}
          disabled={selectedUsers.length === 0 || isCreating}
          variant="contained"
        >
          {isCreating ? <CircularProgress size={20} /> : "Create"}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
};

export default CreateDmDialog;
