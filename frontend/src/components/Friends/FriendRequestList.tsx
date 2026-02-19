import React, { useState } from "react";
import {
  Box,
  List,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  friendsControllerGetPendingRequestsOptions,
  friendsControllerAcceptFriendRequestMutation,
  friendsControllerDeclineFriendRequestMutation,
  friendsControllerCancelFriendRequestMutation,
  userControllerGetProfileOptions,
} from "../../api-client/@tanstack/react-query.gen";

import FriendRequestCard from "./FriendRequestCard";
import EmptyState from "../Common/EmptyState";
import { logger } from "../../utils/logger";

interface FriendRequestListProps {
  compact?: boolean;
}

const FriendRequestList: React.FC<FriendRequestListProps> = ({
  compact: _compact = false,
}) => {
  const [tabValue, setTabValue] = useState<"received" | "sent">("received");
  const queryClient = useQueryClient();
  const { data: requests, isLoading, error } = useQuery(friendsControllerGetPendingRequestsOptions());
  const { data: currentUser } = useQuery(userControllerGetProfileOptions());

  const { mutateAsync: acceptRequest } = useMutation({
    ...friendsControllerAcceptFriendRequestMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'friendsControllerGetFriends' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'friendsControllerGetPendingRequests' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'friendsControllerGetFriendshipStatus' }] });
    },
  });
  const { mutateAsync: declineRequest } = useMutation({
    ...friendsControllerDeclineFriendRequestMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'friendsControllerGetFriends' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'friendsControllerGetPendingRequests' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'friendsControllerGetFriendshipStatus' }] });
    },
  });
  const { mutateAsync: cancelRequest } = useMutation({
    ...friendsControllerCancelFriendRequestMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'friendsControllerGetFriends' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'friendsControllerGetPendingRequests' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'friendsControllerGetFriendshipStatus' }] });
    },
  });

  const handleAccept = async (friendshipId: string) => {
    try {
      await acceptRequest({ path: { id: friendshipId } });
    } catch (err) {
      logger.error("Failed to accept friend request:", err);
    }
  };

  const handleDecline = async (friendshipId: string) => {
    try {
      await declineRequest({ path: { id: friendshipId } });
    } catch (err) {
      logger.error("Failed to decline friend request:", err);
    }
  };

  const handleCancel = async (friendshipId: string) => {
    try {
      await cancelRequest({ path: { id: friendshipId } });
    } catch (err) {
      logger.error("Failed to cancel friend request:", err);
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
