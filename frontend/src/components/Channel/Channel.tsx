import { useCallback } from "react";
import {
  Channel as ChannelType,
  ChannelType as ChannelKind,
} from "../../types/channel.type";
import { Box, alpha } from "@mui/material";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import TagIcon from "@mui/icons-material/Tag";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { styled } from "@mui/material/styles";
import { useNavigate, useParams } from "react-router-dom";
import { VoiceChannelUserList } from "../Voice";
import { useVoiceConnection } from "../../hooks/useVoiceConnection";
import type { ListItemProps } from "@mui/material/ListItem";
import { useNotification } from "../../contexts/NotificationContext";
import { logger } from "../../utils/logger";

interface ChannelProps {
  channel: ChannelType;
}

interface ChannelContainerProps extends ListItemProps {
  isSelected?: boolean;
}

const ChannelName = styled(ListItemText)(({ theme }) => ({
  "& .MuiListItemText-primary": {
    fontWeight: 500,
    fontSize: theme.typography.body2.fontSize,
  },
}));

const ChannelContainer = styled(ListItem, {
  shouldForwardProp: (prop) => prop !== "isSelected",
})<ChannelContainerProps>(({ theme, isSelected }) => ({
  padding: theme.spacing(0.75, 1.5),
  marginLeft: theme.spacing(1),
  marginRight: theme.spacing(1),
  marginBottom: theme.spacing(0.25),
  borderRadius: theme.spacing(1),
  display: "flex",
  alignItems: "center",
  width: "auto",
  transition: "all 0.15s ease-in-out",
  backgroundColor: isSelected
    ? theme.palette.mode === "dark"
      ? alpha(theme.palette.primary.main, 0.2)
      : alpha(theme.palette.primary.main, 0.12)
    : "transparent",
  color: isSelected ? theme.palette.primary.main : theme.palette.text.secondary,
  "&:hover": {
    backgroundColor: isSelected
      ? theme.palette.mode === "dark"
        ? alpha(theme.palette.primary.main, 0.25)
        : alpha(theme.palette.primary.main, 0.15)
      : theme.palette.mode === "dark"
        ? alpha(theme.palette.common.white, 0.08)
        : alpha(theme.palette.common.black, 0.04),
    color: isSelected ? theme.palette.primary.main : theme.palette.text.primary,
  },
}));

export function Channel({ channel }: ChannelProps) {
  const navigate = useNavigate();
  const { communityId, channelId } = useParams<{
    communityId: string;
    channelId: string;
  }>();
  const { state: voiceState, actions: voiceActions } = useVoiceConnection();
  const { showNotification } = useNotification();

  const handleClick = useCallback(async () => {
    if (channel.type === ChannelKind.TEXT) {
      // Navigate to text channel
      navigate(`/community/${communityId}/channel/${channel.id}`);
    } else if (channel.type === ChannelKind.VOICE) {
      // For voice channels, join the voice channel and navigate
      try {
        if (voiceState.currentChannelId === channel.id && voiceState.isConnected) {
          // Already connected to this channel, just navigate to show video tiles
          navigate(`/community/${communityId}/channel/${channel.id}`);
        } else {
          // Join the voice channel
          await voiceActions.joinVoiceChannel(
            channel.id,
            channel.name,
            communityId!,
            channel.isPrivate || false,
            channel.createdAt
          );
          // Navigate to the voice channel page
          navigate(`/community/${communityId}/channel/${channel.id}`);
        }
      } catch (error) {
        logger.error("Failed to join voice channel:", error);
        showNotification("Failed to join voice channel. Please try again.", "error");
      }
    }
  }, [
    channel.type,
    channel.id,
    channel.name,
    channel.isPrivate,
    channel.createdAt,
    communityId,
    navigate,
    voiceState.currentChannelId,
    voiceState.isConnected,
    voiceActions,
    showNotification,
  ]);

  return (
    <Box>
      <ChannelContainer
        isSelected={channelId === channel.id}
        sx={{ pl: 2, cursor: "pointer" }}
        onClick={handleClick}
      >
        <ListItemIcon sx={{ minWidth: 28, color: "inherit" }}>
          {channel.type === ChannelKind.TEXT ? (
            <TagIcon sx={{ fontSize: 18 }} />
          ) : (
            <VolumeUpIcon sx={{ fontSize: 18 }} />
          )}
        </ListItemIcon>
        <ChannelName primary={channel.name} />
      </ChannelContainer>

      {/* Discord-style voice users nested under the channel */}
      {channel.type === ChannelKind.VOICE && (
        <VoiceChannelUserList channel={channel} showDiscordStyle />
      )}
    </Box>
  );
}
