import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  communityControllerFindOneOptions,
  channelsControllerFindOneOptions,
} from "../api-client/@tanstack/react-query.gen";
import { Avatar, Box, Typography, Paper } from "@mui/material";
import ChannelList from "../components/Channel/ChannelList";
import ChannelMessageContainer from "../components/Channel/ChannelMessageContainer";
import { VoiceChannelUserList } from "../components/Voice";
import EditCommunityButton from "../components/Community/EditCommunityButton";
import { styled } from "@mui/material/styles";
import { useCommunityJoin } from "../hooks/useCommunityJoin";
import { ChannelType } from "../types/channel.type";
import { useVoiceConnection } from "../hooks/useVoiceConnection";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedImage";
import { useResponsive } from "../hooks/useResponsive";
import { useVideoOverlay } from "../contexts/VideoOverlayContext";

const CommunityPage: React.FC = () => {
  const { isMobile } = useResponsive();
  const { communityId } = useParams<{ communityId: string }>();

  useCommunityJoin(communityId);

  // Mobile version is handled by MobileLayout with panel navigation
  if (isMobile) {
    return null;
  }

  // Desktop version below
  return <DesktopCommunityPage />;
};

const DesktopCommunityPage: React.FC = () => {
  const { communityId, channelId } = useParams<{
    communityId: string;
    channelId: string;
  }>();
  const { data, error, isLoading } = useQuery({
    ...communityControllerFindOneOptions({ path: { id: communityId! } }),
    enabled: !!communityId,
  });
  const { data: channelData } = useQuery({
    ...channelsControllerFindOneOptions({ path: { id: channelId! } }),
    enabled: !!channelId,
  });
  const { state: voiceState } = useVoiceConnection();
  const { blobUrl: communityAvatarUrl } = useAuthenticatedImage(data?.avatar);
  const { setContainerElement } = useVideoOverlay();

  if (!communityId) return <div>Community ID is required</div>;
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading community data</div>;
  if (!data) return <div>No community data found</div>;

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

    if (channelData?.type === ChannelType.VOICE) {
      const isConnectedToThisChannel = voiceState.isConnected &&
        voiceState.currentChannelId === channelId;

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

          {isConnectedToThisChannel ? (
            <Typography variant="body1" color="success.main" textAlign="center">
              Connected — Video tiles are in the floating overlay
            </Typography>
          ) : (
            <Typography variant="body1" color="text.secondary" textAlign="center">
              Click on this voice channel in the sidebar to join
            </Typography>
          )}

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

    if (voiceState.isConnected && channelData?.type === ChannelType.TEXT) {
      return <ChannelMessageContainer channelId={channelId} />;
    }

    return <ChannelMessageContainer channelId={channelId} />;
  };

  return (
    <Root>
      <Sidebar>
        <CommunityHeader>
          <CommunityInfo>
            <Avatar
              src={communityAvatarUrl || undefined}
              alt={`${data.name} logo`}
              sx={{ width: 40, height: 40 }}
            >
              {data.name.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              {data.name}
            </Typography>
          </CommunityInfo>
          <EditCommunityButton communityId={communityId} />
        </CommunityHeader>
        <ChannelList communityId={communityId} />
      </Sidebar>
      <Content ref={setContainerElement}>
        {renderChannelContent()}
      </Content>
    </Root>
  );
};

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
  // Let theme control boxShadow for vibrant mode glow effects
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

export default CommunityPage;
