import { useCallback } from "react";
import {
  Channel as ChannelType,
  ChannelType as ChannelKind,
} from "../../types/channel.type";
import { Box, IconButton } from "@mui/material";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { styled } from "@mui/material/styles";
import { useNavigate, useParams } from "react-router-dom";
import { VoiceChannelUserList } from "../Voice";
import { useVoiceConnection } from "../../hooks/useVoiceConnection";
import {
  useMoveChannelUpMutation,
  useMoveChannelDownMutation,
} from "../../features/channel/channelApiSlice";
import type { ListItemProps } from "@mui/material/ListItem";
import { useNotification } from "../../contexts/NotificationContext";

interface ChannelProps {
  channel: ChannelType;
  showReorderButtons?: boolean;
  isFirstInType?: boolean;
  isLastInType?: boolean;
}

interface ChannelContainerProps extends ListItemProps {
  isSelected?: boolean;
}

const ChannelName = styled(ListItemText)(({ theme }) => ({
  fontWeight: 500,
  fontSize: theme.typography.body2.fontSize,
}));

const ChannelContainer = styled(ListItem, {
  shouldForwardProp: (prop) => prop !== "isSelected",
})<ChannelContainerProps>(({ theme, isSelected }) => ({
  padding: theme.spacing(0.5, 2),
  display: "flex",
  alignItems: "center",
  width: "100%",
  backgroundColor: isSelected ? theme.palette.action.selected : undefined,
  fontWeight: isSelected ? 600 : undefined,
  "&:hover": {
    backgroundColor: isSelected
      ? theme.palette.action.selected
      : theme.palette.action.hover,
  },
}));

export function Channel({
  channel,
  showReorderButtons = false,
  isFirstInType = false,
  isLastInType = false,
}: ChannelProps) {
  const navigate = useNavigate();
  const { communityId, channelId } = useParams<{
    communityId: string;
    channelId: string;
  }>();
  const { state: voiceState, actions: voiceActions } = useVoiceConnection();
  const { showNotification } = useNotification();

  const [moveUp, { isLoading: isMovingUp }] = useMoveChannelUpMutation();
  const [moveDown, { isLoading: isMovingDown }] = useMoveChannelDownMutation();

  const handleMoveUp = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isFirstInType || isMovingUp || !communityId) return;

      try {
        await moveUp({
          channelId: channel.id,
          communityId,
        }).unwrap();
      } catch (error) {
        console.error("Failed to move channel up:", error);
        showNotification("Failed to reorder channel", "error");
      }
    },
    [isFirstInType, isMovingUp, communityId, moveUp, channel.id, showNotification]
  );

  const handleMoveDown = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isLastInType || isMovingDown || !communityId) return;

      try {
        await moveDown({
          channelId: channel.id,
          communityId,
        }).unwrap();
      } catch (error) {
        console.error("Failed to move channel down:", error);
        showNotification("Failed to reorder channel", "error");
      }
    },
    [isLastInType, isMovingDown, communityId, moveDown, channel.id, showNotification]
  );

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
        console.error("Failed to join voice channel:", error);
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
        <ListItemIcon sx={{ minWidth: 32 }}>
          {channel.type === ChannelKind.TEXT ? (
            <ChatBubbleOutlineIcon fontSize="small" />
          ) : (
            <VolumeUpOutlinedIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ChannelName primary={channel.name} />
        {showReorderButtons && (
          <Box
            sx={{
              display: "flex",
              ml: "auto",
              opacity: 0,
              transition: "opacity 0.2s",
              ".MuiListItem-root:hover &": {
                opacity: 1,
              },
            }}
          >
            <IconButton
              size="small"
              onClick={handleMoveUp}
              disabled={isFirstInType || isMovingUp}
              sx={{
                p: 0.5,
                visibility: isFirstInType ? "hidden" : "visible",
              }}
            >
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleMoveDown}
              disabled={isLastInType || isMovingDown}
              sx={{
                p: 0.5,
                visibility: isLastInType ? "hidden" : "visible",
              }}
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </ChannelContainer>

      {/* Discord-style voice users nested under the channel */}
      {channel.type === ChannelKind.VOICE && (
        <VoiceChannelUserList channel={channel} showDiscordStyle />
      )}
    </Box>
  );
}
