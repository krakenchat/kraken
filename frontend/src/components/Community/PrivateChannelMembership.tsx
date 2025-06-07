import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
} from "@mui/material";
import {
  useGetMembersForChannelQuery,
  useGetMembersForCommunityQuery,
} from "../../features/membership";
import { useUserPermissions } from "../../features/roles/useUserPermissions";
import type { Channel } from "../../types/channel.type";
import { ChannelMembersList } from "./components/ChannelMembersList";
import { AddChannelMembers } from "./components/AddChannelMembers";
import { ChannelSelector } from "./components/ChannelSelector";

interface PrivateChannelMembershipProps {
  channels: Channel[];
  communityId: string;
}

const PrivateChannelMembership: React.FC<PrivateChannelMembershipProps> = ({ 
  channels,
  communityId 
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");

  // Filter to only private channels
  const privateChannels = channels.filter(channel => channel.isPrivate);
  const selectedChannel = privateChannels.find(ch => ch.id === selectedChannelId);

  const {
    data: channelMembers,
    isLoading: loadingChannelMembers,
    error: channelMembersError,
  } = useGetMembersForChannelQuery(selectedChannelId, {
    skip: !selectedChannelId,
  });

  const {
    data: communityMembers,
    isLoading: loadingCommunityMembers,
    error: communityMembersError,
  } = useGetMembersForCommunityQuery(communityId);

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
    <Box display="flex" flexDirection="column" gap={3}>
      {/* Channel Selection */}
      <ChannelSelector
        privateChannels={privateChannels}
        selectedChannelId={selectedChannelId}
        onChannelSelect={setSelectedChannelId}
      />

      {selectedChannelId && (
        <>
          {/* Current Channel Members Section */}
          <ChannelMembersList
            channelId={selectedChannelId}
            channelName={selectedChannel?.name || ""}
            members={channelMembers}
            isLoading={loadingChannelMembers}
            error={channelMembersError}
            canDeleteMembers={canDeleteMembers}
          />

          {/* Add Members Section */}
          {canCreateMembers && (
            <AddChannelMembers
              channelId={selectedChannelId}
              channelName={selectedChannel?.name || ""}
              communityMembers={communityMembers}
              channelMembers={channelMembers}
              isLoadingCommunityMembers={loadingCommunityMembers}
              communityMembersError={communityMembersError}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default PrivateChannelMembership;
