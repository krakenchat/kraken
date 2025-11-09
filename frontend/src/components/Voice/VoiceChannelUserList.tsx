import React from "react";
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  Mic,
  MicOff,
  Videocam,
  ScreenShare,
  VolumeOff,
} from "@mui/icons-material";
import { useGetChannelPresenceQuery } from "../../features/voice-presence/voicePresenceApiSlice";
import { formatDistanceToNow } from "date-fns";
import { Channel } from "../../types/channel.type";
import { ChannelType } from "../../types/channel.type";
import { useSpeakingDetection } from "../../hooks/useSpeakingDetection";
import { useParticipantTracks } from "../../hooks/useParticipantTracks";
import UserAvatar from "../Common/UserAvatar";

interface VoiceChannelUserListProps {
  channel: Channel;
  showInline?: boolean;
  showDiscordStyle?: boolean;
}

export const VoiceChannelUserList: React.FC<VoiceChannelUserListProps> = ({
  channel,
  showInline = false,
  showDiscordStyle = false,
}) => {

  const {
    data: presence,
    isLoading,
    error,
  } = useGetChannelPresenceQuery(channel.id, {
    skip: channel.type !== ChannelType.VOICE,
  });

  // Hook for real-time speaking detection via LiveKit
  const { isSpeaking } = useSpeakingDetection();

  if (channel.type !== ChannelType.VOICE) {
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Loading voice channel...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="error">
          Failed to load voice channel users
        </Typography>
      </Box>
    );
  }

  if (!presence || presence.users.length === 0) {
    return null;
  }

  const DiscordStyleUserItem: React.FC<{
    user: (typeof presence.users)[0];
  }> = React.memo(({ user }) => {
    // Real-time speaking detection from LiveKit
    const speaking = isSpeaking(user.id);

    // Get LiveKit state for this user (if they're in the room)
    const livekitState = useParticipantTracks(user.id);

    // Prefer LiveKit state if participant is in room, otherwise use server state
    const userState = {
      isMuted: livekitState.participant
        ? !livekitState.isMicrophoneEnabled
        : Boolean(user.isMuted),
      isDeafened: Boolean(user.isDeafened), // Custom state - only in server
      isVideoEnabled: livekitState.participant
        ? livekitState.isCameraEnabled
        : Boolean(user.isVideoEnabled),
      isScreenSharing: livekitState.participant
        ? livekitState.isScreenShareEnabled
        : Boolean(user.isScreenSharing),
    };
    
    return (
      <ListItem
        sx={{
          px: 1,
          py: 0.5,
          pl: 4, // Indent under voice channel like Discord
          minHeight: 40,
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.03)",
          },
        }}
      >
        <ListItemAvatar sx={{ minWidth: 40 }}>
          <Box sx={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Box
              sx={{
                border: speaking ? "2px solid #00ff00" : "2px solid transparent",
                transition: "border-color 0.2s ease",
                borderRadius: "50%",
              }}
            >
              <UserAvatar user={user} size="small" />
            </Box>
            
            {/* Audio status badge - Discord-style (deafen takes priority over mute) */}
            {userState.isDeafened ? (
              <Box
                sx={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  backgroundColor: "#f04747",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid",
                  borderColor: "background.paper",
                }}
              >
                <VolumeOff sx={{ fontSize: 10, color: "white" }} />
              </Box>
            ) : userState.isMuted ? (
              <Box
                sx={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  backgroundColor: "#f04747",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid",
                  borderColor: "background.paper",
                }}
              >
                <MicOff sx={{ fontSize: 10, color: "white" }} />
              </Box>
            ) : null}
          </Box>
        </ListItemAvatar>

        <ListItemText
          primary={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 500,
                  color: userState.isMuted ? "text.secondary" : "text.primary",
                  fontSize: "14px"
                }}
              >
                {user.displayName || user.username}
              </Typography>
              
              {/* Status indicators - Discord-style (deafen takes priority over mute) */}
              <Box sx={{ display: "flex", gap: 0.5, ml: "auto", alignItems: "center" }}>

                {/* Deafened state takes priority over muted */}
                {userState.isDeafened ? (
                  <Tooltip title="Deafened">
                    <VolumeOff sx={{ fontSize: 16, color: "#f04747" }} />
                  </Tooltip>
                ) : userState.isMuted ? (
                  <Tooltip title="Muted">
                    <MicOff sx={{ fontSize: 16, color: "#f04747" }} />
                  </Tooltip>
                ) : null}

                {/* Video enabled state */}
                {userState.isVideoEnabled && (
                  <Tooltip title="Camera">
                    <Videocam sx={{ fontSize: 16, color: "#43b581" }} />
                  </Tooltip>
                )}

                {/* Screen sharing state */}
                {userState.isScreenSharing && (
                  <Tooltip title="Screen Share">
                    <ScreenShare sx={{ fontSize: 16, color: "#593695" }} />
                  </Tooltip>
                )}
              </Box>
            </Box>
          }
        />
      </ListItem>
    );
  });

  const UserItem: React.FC<{
    user: (typeof presence.users)[0];
    index: number;
  }> = React.memo(({ user, index }) => {
    // Get LiveKit state for this user (if they're in the room)
    const livekitState = useParticipantTracks(user.id);

    // Prefer LiveKit state if participant is in room, otherwise use server state
    const isMuted = livekitState.participant
      ? !livekitState.isMicrophoneEnabled
      : Boolean(user.isMuted);
    const isDeafened = Boolean(user.isDeafened); // Custom state - only in server
    const isVideoEnabled = livekitState.participant
      ? livekitState.isCameraEnabled
      : Boolean(user.isVideoEnabled);
    const isScreenSharing = livekitState.participant
      ? livekitState.isScreenShareEnabled
      : Boolean(user.isScreenSharing);

    const statusIcons = [];

    if (isMuted) statusIcons.push(<MicOff key="muted" fontSize="small" />);
    else statusIcons.push(<Mic key="mic" fontSize="small" />);

    if (isDeafened)
      statusIcons.push(<VolumeOff key="deafened" fontSize="small" />);
    if (isVideoEnabled)
      statusIcons.push(<Videocam key="video" fontSize="small" />);
    if (isScreenSharing)
      statusIcons.push(<ScreenShare key="screen" fontSize="small" />);

    const joinedAgo = formatDistanceToNow(new Date(user.joinedAt), {
      addSuffix: true,
    });

    return (
      <React.Fragment key={user.id}>
        <ListItem
          sx={{
            px: showInline ? 1 : 2,
            py: 1,
            "&:hover": {
              backgroundColor: "action.hover",
            },
          }}
        >
          <ListItemAvatar>
            <UserAvatar user={user} size="small" />
          </ListItemAvatar>

          <ListItemText
            primary={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" fontWeight="medium">
                  {user.displayName || user.username}
                </Typography>
                <Box
                  sx={{ display: "flex", gap: 0.5, color: "text.secondary" }}
                >
                  {statusIcons.map((icon, i) => (
                    <Box key={i} sx={{ display: "flex", alignItems: "center" }}>
                      {icon}
                    </Box>
                  ))}
                </Box>
              </Box>
            }
            secondary={
              !showInline && (
                <Typography variant="caption" color="text.secondary">
                  Joined {joinedAgo}
                </Typography>
              )
            }
          />
        </ListItem>
        {index < presence.users.length - 1 && <Divider />}
      </React.Fragment>
    );
  });

  // Inline avatar display with video indicator
  const InlineUserAvatar: React.FC<{ user: (typeof presence.users)[0] }> = ({ user }) => {
    const livekitState = useParticipantTracks(user.id);
    const isVideoEnabled = livekitState.participant
      ? livekitState.isCameraEnabled
      : Boolean(user.isVideoEnabled);

    return (
      <Tooltip key={user.id} title={user.displayName || user.username}>
        <Box
          sx={{
            width: 24,
            height: 24,
            border: isVideoEnabled ? "2px solid" : "none",
            borderColor: "primary.main",
            borderRadius: "50%",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <UserAvatar user={user} size="small" />
        </Box>
      </Tooltip>
    );
  };

  if (showInline) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          flexWrap: "wrap",
        }}
      >
        {presence.users.slice(0, 3).map((user) => (
          <InlineUserAvatar key={user.id} user={user} />
        ))}
        {presence.users.length > 3 && (
          <Chip
            label={`+${presence.users.length - 3}`}
            size="small"
            sx={{ height: 24, fontSize: "0.75rem" }}
          />
        )}
      </Box>
    );
  }

  // Discord-style nested display under voice channels
  if (showDiscordStyle) {
    return (
      <Box>
        {presence.users.map((user) => (
          <DiscordStyleUserItem key={user.id} user={user} />
        ))}
      </Box>
    );
  }

  return (
    <Paper
      elevation={2}
      sx={{
        maxHeight: 300,
        overflow: "auto",
        "&::-webkit-scrollbar": {
          width: 6,
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "rgba(0,0,0,0.2)",
          borderRadius: 3,
        },
      }}
    >
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="h6" gutterBottom>
          Voice Channel — {presence.count}{" "}
          {presence.count === 1 ? "user" : "users"}
        </Typography>
      </Box>

      <List disablePadding>
        {presence.users.map((user, index) => (
          <UserItem key={user.id} user={user} index={index} />
        ))}
      </List>
    </Paper>
  );
};
