import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Typography,
  Alert,
  IconButton,
} from "@mui/material";
import { PersonAdd as AddIcon, Check as SentIcon } from "@mui/icons-material";
import { useLazySearchUsersQuery, useProfileQuery } from "../../features/users/usersSlice";
import {
  useSendFriendRequestMutation,
  useGetFriendshipStatusQuery,
} from "../../features/friends/friendsApiSlice";
import { User } from "../../types/auth.type";
import UserAvatar from "../Common/UserAvatar";

interface AddFriendDialogProps {
  open: boolean;
  onClose: () => void;
}

interface UserWithFriendStatus extends User {
  friendStatus?: "none" | "pending" | "friends";
}

const AddFriendDialog: React.FC<AddFriendDialogProps> = ({ open, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, { data: searchResults, isLoading, isFetching }] =
    useLazySearchUsersQuery();
  const { data: currentUser } = useProfileQuery();
  const [sendFriendRequest, { isLoading: isSending }] =
    useSendFriendRequestMutation();
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleSearch = () => {
    if (searchQuery.trim().length >= 2) {
      searchUsers({ query: searchQuery.trim() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      setError(null);
      await sendFriendRequest(userId).unwrap();
      setSentRequests((prev) => new Set(prev).add(userId));
    } catch (err: unknown) {
      const errorMessage =
        err && typeof err === 'object' && 'data' in err
          ? (err as { data?: { message?: string } }).data?.message || "Failed to send friend request"
          : "Failed to send friend request";
      setError(errorMessage);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSentRequests(new Set());
    setError(null);
    onClose();
  };

  // Filter out current user from results
  const filteredResults =
    searchResults?.filter((user) => user.id !== currentUser?.id) || [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Friend</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Search by username"
            placeholder="Enter a username to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            margin="normal"
            autoFocus
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={searchQuery.trim().length < 2 || isLoading}
            sx={{ mt: 1 }}
          >
            {isLoading || isFetching ? <CircularProgress size={20} /> : "Search"}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {filteredResults.length > 0 && (
          <List>
            {filteredResults.map((user) => (
              <ListItem key={user.id}>
                <ListItemAvatar>
                  <UserAvatar user={user} size="medium" />
                </ListItemAvatar>
                <ListItemText
                  primary={user.displayName || user.username}
                  secondary={`@${user.username}`}
                />
                <ListItemSecondaryAction>
                  {sentRequests.has(user.id) ? (
                    <IconButton disabled color="success">
                      <SentIcon />
                    </IconButton>
                  ) : (
                    <IconButton
                      onClick={() => handleSendRequest(user.id)}
                      disabled={isSending}
                      color="primary"
                    >
                      <AddIcon />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}

        {searchResults && filteredResults.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
            No users found
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddFriendDialog;
