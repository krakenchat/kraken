import {
  Channel as ChannelType,
  ChannelType as ChannelKind,
} from "../../types/channel.type";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import { styled } from "@mui/material/styles";
import { useNavigate, useParams } from "react-router-dom";

interface ChannelProps {
  channel: ChannelType;
}

const ChannelName = styled(ListItemText)(({ theme }) => ({
  fontWeight: 500,
  fontSize: theme.typography.body2.fontSize,
}));

export function Channel({ channel }: ChannelProps) {
  const navigate = useNavigate();
  const { communityId } = useParams<{ communityId: string }>();

  const handleClick = () => {
    navigate(`/community/${communityId}/channel/${channel.id}`);
  };

  return (
    <ListItem sx={{ pl: 2, cursor: "pointer" }} onClick={handleClick}>
      <ListItemIcon sx={{ minWidth: 32 }}>
        {channel.type === ChannelKind.TEXT ? (
          <ChatBubbleOutlineIcon fontSize="small" />
        ) : (
          <VolumeUpOutlinedIcon fontSize="small" />
        )}
      </ListItemIcon>
      <ChannelName primary={channel.name} />
    </ListItem>
  );
}
