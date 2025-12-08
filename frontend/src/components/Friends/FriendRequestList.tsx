import React, { useState } from "react";
import {
  Box,
  List,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
} from "@mui/material";
import {
  useGetPendingRequestsQuery,
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useCancelFriendRequestMutation,
} from "../../features/friends/friendsApiSlice";
import { useProfileQuery } from "../../features/users/usersSlice";
import FriendRequestCard from "./FriendRequestCard";
import EmptyState from "../Common/EmptyState";

interface FriendRequestListProps {
  compact?: boolean;
}

const FriendRequestList: React.FC<FriendRequestListProps> = ({
  compact = false,
}) => {
  const [tabValue, setTabValue] = useState<"received" | "sent">("received");
  const { data: requests, isLoading, error } = useGetPendingRequestsQuery();
  const { data: currentUser } = useProfileQuery();

  const [acceptRequest] = useAcceptFriendRequestMutation();
  const [declineRequest] = useDeclineFriendRequestMutation();
  const [cancelRequest] = useCancelFriendRequestMutation();

  const handleAccept = async (friendshipId: string) => {
    try {
      await acceptRequest(friendshipId).unwrap();
    } catch (err) {
      console.error("Failed to accept friend request:", err);
    }
  };

  const handleDecline = async (friendshipId: string) => {
    try {
      await declineRequest(friendshipId).unwrap();
    } catch (err) {
      console.error("Failed to decline friend request:", err);
    }
  };

  const handleCancel = async (friendshipId: string) => {
    try {
      await cancelRequest(friendshipId).unwrap();
    } catch (err) {
      console.error("Failed to cancel friend request:", err);
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
        <Alert severity="error">Failed to load friend requests</Alert>
      </Box>
    );
  }

  const receivedCount = requests?.received.length || 0;
  const sentCount = requests?.sent.length || 0;
  const currentRequests =
    tabValue === "received" ? requests?.received || [] : requests?.sent || [];

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label={
            <Badge badgeContent={receivedCount} color="primary">
              <Box sx={{ pr: receivedCount > 0 ? 2 : 0 }}>Received</Box>
            </Badge>
          }
          value="received"
        />
        <Tab
          label={
            <Badge badgeContent={sentCount} color="default">
              <Box sx={{ pr: sentCount > 0 ? 2 : 0 }}>Sent</Box>
            </Badge>
          }
          value="sent"
        />
      </Tabs>

      <Box sx={{ flex: 1, overflow: "auto" }}>
        {currentRequests.length === 0 ? (
          <EmptyState
            variant="dm"
            title={
              tabValue === "received"
                ? "No pending requests"
                : "No sent requests"
            }
            description={
              tabValue === "received"
                ? "Friend requests you receive will appear here"
                : "Friend requests you send will appear here"
            }
          />
        ) : (
          <List>
            {currentRequests.map((request) => (
              <FriendRequestCard
                key={request.id}
                request={request}
                type={tabValue}
                currentUserId={currentUser?.id || ""}
                onAccept={tabValue === "received" ? handleAccept : undefined}
                onDecline={tabValue === "received" ? handleDecline : undefined}
                onCancel={tabValue === "sent" ? handleCancel : undefined}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default FriendRequestList;
