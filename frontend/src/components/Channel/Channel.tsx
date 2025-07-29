import {
  Channel as ChannelType,
  ChannelType as ChannelKind,
} from "../../types/channel.type";
import { Box } from "@mui/material";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import { styled } from "@mui/material/styles";
import { useNavigate, useParams } from "react-router-dom";
import { VoiceChannelUserList } from "../Voice";
import { useVoiceConnection } from "../../contexts/VoiceConnectionContext";
import type { ListItemProps } from "@mui/material/ListItem";

interface ChannelProps {
  channel: ChannelType;
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

export function Channel({ channel }: ChannelProps) {
  const navigate = useNavigate();
  const { communityId, channelId } = useParams<{
    communityId: string;
    channelId: string;
  }>();
  const { state: voiceState, actions: voiceActions } = useVoiceConnection();

  const handleClick = async () => {
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
        console.error('Failed to join voice channel:', error);
      }
    }
  };

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
        <ChannelName 
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>{channel.name}</span>
              {channel.type === ChannelKind.VOICE && (
                <VoiceChannelUserList channel={channel} showInline />
              )}
            </Box>
          } 
        />
      </ChannelContainer>
    </Box>
  );
}
