import React from "react";
import {
  Box,
  List,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  useGetFriendsQuery,
  useRemoveFriendMutation,
} from "../../features/friends/friendsApiSlice";
import { useCreateDmGroupMutation } from "../../features/directMessages/directMessagesApiSlice";
import { useProfileQuery } from "../../features/users/usersSlice";
import FriendCard from "./FriendCard";
import EmptyState from "../Common/EmptyState";

interface FriendListProps {
  onSelectDmGroup?: (dmGroupId: string) => void;
}

const FriendList: React.FC<FriendListProps> = ({ onSelectDmGroup }) => {
  const navigate = useNavigate();
  const { data: friends = [], isLoading, error } = useGetFriendsQuery();
  const { data: currentUser } = useProfileQuery();
  const [removeFriend] = useRemoveFriendMutation();
  const [createDmGroup] = useCreateDmGroupMutation();

  // We need to track the friendship IDs with each friend
  // For now, we'll fetch the friendship status when needed
  // This is a limitation - ideally the backend would return friendship IDs with the friends list

  const handleMessage = async (userId: string) => {
    try {
      // Create or get existing DM with this user
      const result = await createDmGroup({
        userIds: [userId],
        isGroup: false,
      }).unwrap();

      if (onSelectDmGroup) {
        onSelectDmGroup(result.id);
      } else {
        // Navigate to DM view if no callback
        navigate(`/dm/${result.id}`);
      }
    } catch (err) {
      console.error("Failed to create DM:", err);
    }
  };

  const handleRemove = async (friendshipId: string) => {
    try {
      await removeFriend(friendshipId).unwrap();
    } catch (err) {
      console.error("Failed to remove friend:", err);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Failed to load friends</Alert>
      </Box>
    );
  }

  if (friends.length === 0) {
    return (
      <EmptyState
        variant="dm"
        title="No friends yet"
        description="Add friends to see them here"
      />
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: "auto" }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 2, py: 1, display: "block", textTransform: "uppercase" }}
      >
        All Friends - {friends.length}
      </Typography>
      <List>
        {friends.map((friend) => (
          <FriendCard
            key={friend.id}
            friend={friend}
            friendshipId={friend.id} // Note: This should be the friendship ID, not user ID
            onMessage={handleMessage}
            onRemove={handleRemove}
          />
        ))}
      </List>
    </Box>
  );
};

export default FriendList;
