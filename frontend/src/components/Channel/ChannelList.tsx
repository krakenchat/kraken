import React, { useMemo } from "react";
import { useGetChannelsForCommunityQuery } from "../../features/channel/channelApiSlice";
import { Channel as ChannelComponent } from "./Channel";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
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

  if (isLoading)
    return <Typography variant="body2">Loading channels...</Typography>;
  if (error)
    return <Typography color="error">Failed to load channels.</Typography>;
  if (!channels || channels.length === 0)
    return <Typography variant="body2">No channels found.</Typography>;

  return (
    <List sx={{ width: "100%", padding: 0 }}>
      {sortedChannels.map((channel) => (
        <ChannelComponent key={channel.id} channel={channel} />
      ))}
    </List>
  );
};

export default ChannelList;
