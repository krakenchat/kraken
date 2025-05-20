import React from "react";
import { useGetChannelsForCommunityQuery } from "../../features/channel/channelApiSlice";
import { Channel as ChannelComponent } from "./Channel";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";

interface ChannelListProps {
  communityId: string;
}

const ChannelList: React.FC<ChannelListProps> = ({ communityId }) => {
  const {
    data: channels,
    isLoading,
    error,
  } = useGetChannelsForCommunityQuery(communityId);

  if (isLoading)
    return <Typography variant="body2">Loading channels...</Typography>;
  if (error)
    return <Typography color="error">Failed to load channels.</Typography>;
  if (!channels || channels.length === 0)
    return <Typography variant="body2">No channels found.</Typography>;

  return (
    <List sx={{ width: "100%", padding: 0 }}>
      {channels.map((channel) => (
        <ChannelComponent
          key={channel.name + channel.communityId}
          channel={channel}
        />
      ))}
    </List>
  );
};

export default ChannelList;
