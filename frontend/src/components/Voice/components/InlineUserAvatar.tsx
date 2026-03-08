import React from "react";
import { Box, Tooltip } from "@mui/material";
import type { VoicePresenceUserDto } from "../../../api-client/types.gen";
import { useParticipantTracks } from "../../../hooks/useParticipantTracks";
import UserAvatar from "../../Common/UserAvatar";

interface InlineUserAvatarProps {
  user: VoicePresenceUserDto;
  onContextMenu: (event: React.MouseEvent<HTMLElement>, user: VoicePresenceUserDto) => void;
  onClickUser: (userId: string) => void;
}

const InlineUserAvatar: React.FC<InlineUserAvatarProps> = ({
  user,
  onContextMenu,
  onClickUser,
}) => {
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
          cursor: "pointer",
        }}
        onClick={() => onClickUser(user.id)}
        onContextMenu={(e) => onContextMenu(e, user)}
      >
        <UserAvatar userId={user.id} size="small" />
      </Box>
    </Tooltip>
  );
};

export default InlineUserAvatar;
