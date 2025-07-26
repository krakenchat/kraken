import React from "react";
import {
  Box,
  Avatar,
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

interface VoiceChannelUserListProps {
  channel: Channel;
  showInline?: boolean;
}

export const VoiceChannelUserList: React.FC<VoiceChannelUserListProps> = ({
  channel,
  showInline = false,
}) => {
  const {
    data: presence,
    isLoading,
    error,
  } = useGetChannelPresenceQuery(channel.id, {
    skip: channel.type !== ChannelType.VOICE,
    pollingInterval: 10000, // Poll every 10 seconds
  });

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
    return showInline ? null : (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No one in voice channel
        </Typography>
      </Box>
    );
  }

  const UserItem: React.FC<{
    user: (typeof presence.users)[0];
    index: number;
  }> = ({ user, index }) => {
    const statusIcons = [];

    if (user.isMuted) statusIcons.push(<MicOff key="muted" fontSize="small" />);
    else statusIcons.push(<Mic key="mic" fontSize="small" />);

    if (user.isDeafened)
      statusIcons.push(<VolumeOff key="deafened" fontSize="small" />);
    if (user.isVideoEnabled)
      statusIcons.push(<Videocam key="video" fontSize="small" />);
    if (user.isScreenSharing)
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
            <Avatar
              src={user.avatarUrl}
              alt={user.displayName || user.username}
              sx={{ width: 32, height: 32 }}
            >
              {(user.displayName || user.username).charAt(0).toUpperCase()}
            </Avatar>
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
          <Tooltip key={user.id} title={user.displayName || user.username}>
            <Avatar
              src={user.avatarUrl}
              alt={user.displayName || user.username}
              sx={{
                width: 24,
                height: 24,
                border: user.isVideoEnabled ? "2px solid" : "none",
                borderColor: "primary.main",
              }}
            >
              {(user.displayName || user.username).charAt(0).toUpperCase()}
            </Avatar>
          </Tooltip>
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
