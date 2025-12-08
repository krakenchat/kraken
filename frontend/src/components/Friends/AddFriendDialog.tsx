import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useSendFriendRequestMutation } from "../../features/friends/friendsApiSlice";
import UserSearchAutocomplete, { UserOption } from "../Common/UserSearchAutocomplete";

interface AddFriendDialogProps {
  open: boolean;
  onClose: () => void;
}

const AddFriendDialog: React.FC<AddFriendDialogProps> = ({ open, onClose }) => {
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [sendFriendRequest, { isLoading: isSending }] =
    useSendFriendRequestMutation();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendRequest = async () => {
    if (!selectedUser) return;

    try {
      setError(null);
      await sendFriendRequest(selectedUser.id).unwrap();
      setSuccess(true);
      setSelectedUser(null);
    } catch (err: unknown) {
      const errorMessage =
        err && typeof err === "object" && "data" in err
          ? (err as { data?: { message?: string } }).data?.message ||
            "Failed to send friend request"
          : "Failed to send friend request";
      setError(errorMessage);
    }
  };

  const handleClose = () => {
    setSelectedUser(null);
    setSuccess(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Friend</DialogTitle>
      <DialogContent>
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
            Friend request sent!
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <UserSearchAutocomplete
            value={selectedUser}
            onChange={(value) => setSelectedUser(value as UserOption | null)}
            label="Search for a user"
            placeholder="Type to search users..."
            autoFocus
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSendRequest}
          disabled={!selectedUser || isSending}
          variant="contained"
        >
          {isSending ? <CircularProgress size={20} /> : "Send Friend Request"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddFriendDialog;
