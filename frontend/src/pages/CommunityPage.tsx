import React from "react";
import { useParams } from "react-router-dom";
import { useGetCommunityByIdQuery } from "../features/community/communityApiSlice";
import { useGetChannelByIdQuery } from "../features/channel/channelApiSlice";
import { Avatar, Box, Typography, Paper } from "@mui/material";
import ChannelList from "../components/Channel/ChannelList";
import ChannelMessageContainer from "../components/Channel/ChannelMessageContainer";
import { VoiceChannelUserList, VideoTiles } from "../components/Voice";
import EditCommunityButton from "../components/Community/EditCommunityButton";
import { styled } from "@mui/material/styles";
import { useCommunityJoin } from "../hooks/useCommunityJoin";
import { ChannelType } from "../types/channel.type";
import { useVoiceConnection } from "../hooks/useVoiceConnection";

const Root = styled(Box)({
  display: "flex",
  height: "100%",
  width: "100%",
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
});

const Sidebar = styled(Paper)(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  width: 280,
  minWidth: 220,
  maxWidth: 320,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  borderRadius: 0,
  boxShadow: "none",
  borderRight: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2, 0, 0, 0),
  overflowY: "auto",
  zIndex: 2,
}));

const CommunityHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  padding: theme.spacing(0, 2, 2, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const CommunityInfo = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flex: 1,
  minWidth: 0, // Allow text to truncate
}));

const Content = styled(Box)(() => ({
  flex: 1,
  display: "flex",
  flexDirection: "column-reverse",
  alignItems: "center",
  justifyContent: "flex-start",
  overflowY: "auto",
  marginLeft: 280, // match Sidebar width
  height: "100%",
}));

const CommunityPage: React.FC = () => {
  const { communityId, channelId } = useParams<{
    communityId: string;
    channelId: string;
  }>();

  const { data, error, isLoading } = useGetCommunityByIdQuery(communityId!, {
    skip: !communityId,
  });

  // Get channel information to determine type
  const { data: channelData } = useGetChannelByIdQuery(channelId!, {
    skip: !channelId,
  });

  // Get voice connection state to check if video tiles should be shown
  const { state: voiceState } = useVoiceConnection();

  useCommunityJoin(communityId);

  if (!communityId) return <div>Community ID is required</div>;
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading community data</div>;
  if (!data) return <div>No community data found</div>;

  // Determine what to render in the content area
  const renderChannelContent = () => {
    if (!channelId) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Typography variant="h5" color="text.secondary">
            Welcome to {data.name}
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            Select a channel from the sidebar to get started
          </Typography>
        </Box>
      );
    }
    
    // If channel is VOICE type, show voice channel interface  
    if (channelData?.type === ChannelType.VOICE) {
      // Check if we're connected to this specific voice channel
      const isConnectedToThisChannel = voiceState.isConnected && 
        voiceState.currentChannelId === channelId;

      if (isConnectedToThisChannel) {
        // Show video tiles interface when connected to this voice channel
        return (
          <Box
            sx={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <VideoTiles />
          </Box>
        );
      }

      // Show default voice channel interface when not connected to this channel
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: 3,
            p: 4,
          }}
        >
          <Typography variant="h4" textAlign="center">
            🔊 {channelData.name}
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            Click on this voice channel in the sidebar to join and see video tiles.
          </Typography>
          
          {/* Show voice channel participants */}
          <Box sx={{ maxWidth: 600, width: '100%' }}>
            <VoiceChannelUserList channel={channelData} />
          </Box>
          
          {voiceState.isConnected && voiceState.currentChannelId !== channelId && (
            <Typography variant="body2" color="warning.main" textAlign="center" sx={{ maxWidth: 400 }}>
              You're currently connected to "{voiceState.channelName}". Click this channel to switch.
            </Typography>
          )}
        </Box>
      );
    }
    
    // Check if we're connected to a voice channel while viewing a text channel
    // In this case, show a small indicator or keep text interface
    if (voiceState.isConnected && channelData?.type === ChannelType.TEXT) {
      // Show normal text channel interface - voice controls are in bottom bar
      return <ChannelMessageContainer channelId={channelId} />;
    }
    
    // Otherwise, render text message container
    return <ChannelMessageContainer channelId={channelId} />;
  };

  return (
    <Root>
      <Sidebar>
        <CommunityHeader>
          <CommunityInfo>
            <Avatar
              src={data.avatar || ""}
              alt={`${data.name} logo`}
              sx={{ width: 40, height: 40 }}
            />
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              {data.name}
            </Typography>
          </CommunityInfo>
          <EditCommunityButton communityId={communityId} />
        </CommunityHeader>
        <ChannelList communityId={communityId} />
      </Sidebar>
      <Content>
        {renderChannelContent()}
      </Content>
    </Root>
  );
};

export default CommunityPage;
