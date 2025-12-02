import React, { useMemo } from "react";
import { useGetChannelsForCommunityQuery } from "../../features/channel/channelApiSlice";
import { Channel as ChannelComponent } from "./Channel";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import { useCanPerformAction } from "../../features/roles/useUserPermissions";
import { RBAC_ACTIONS } from "../../constants/rbacActions";
import { ChannelType } from "../../types/channel.type";

interface ChannelListProps {
  communityId: string;
}

const ChannelList: React.FC<ChannelListProps> = ({ communityId }) => {
  const {
    data: channels,
    isLoading,
    error,
  } = useGetChannelsForCommunityQuery(communityId);

  const canReorderChannels = useCanPerformAction(
    "COMMUNITY",
    communityId,
    RBAC_ACTIONS.UPDATE_CHANNEL
  );

  // Sort channels: TEXT before VOICE, then by position
  const sortedChannels = useMemo(() => {
    if (!channels) return [];

    return [...channels].sort((a, b) => {
      // First sort by type: TEXT comes before VOICE
      if (a.type !== b.type) {
        return a.type === ChannelType.TEXT ? -1 : 1;
      }
      // Then sort by position within the same type
      return (a.position ?? 0) - (b.position ?? 0);
    });
  }, [channels]);

  // Calculate which channels are first/last in their type group
  const textChannels = sortedChannels.filter(
    (c) => c.type === ChannelType.TEXT
  );
  const voiceChannels = sortedChannels.filter(
    (c) => c.type === ChannelType.VOICE
  );

  if (isLoading)
    return <Typography variant="body2">Loading channels...</Typography>;
  if (error)
    return <Typography color="error">Failed to load channels.</Typography>;
  if (!channels || channels.length === 0)
    return <Typography variant="body2">No channels found.</Typography>;

  return (
    <List sx={{ width: "100%", padding: 0 }}>
      {sortedChannels.map((channel) => {
        const isText = channel.type === ChannelType.TEXT;
        const typeChannels = isText ? textChannels : voiceChannels;
        const indexInType = typeChannels.findIndex((c) => c.id === channel.id);
        const isFirstInType = indexInType === 0;
        const isLastInType = indexInType === typeChannels.length - 1;

        return (
          <ChannelComponent
            key={channel.id}
            channel={channel}
            showReorderButtons={canReorderChannels}
            isFirstInType={isFirstInType}
            isLastInType={isLastInType}
          />
        );
      })}
    </List>
  );
};

export default ChannelList;
