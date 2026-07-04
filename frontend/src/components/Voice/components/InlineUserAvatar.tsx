import React from "react";
import { Box, Tooltip } from "@mui/material";
import type { VoicePresenceUserDto } from "../../../api-client/types.gen";
import { useParticipantTracks } from "../../../hooks/useParticipantTracks";
import UserAvatar from "../../Common/UserAvatar";
import { useResponsive } from "../../../hooks/useResponsive";
import { useLongPress } from "../../../hooks/useSwipeGesture";

interface InlineUserAvatarProps {
  /** WS presence payloads layer isVideoEnabled on top of the REST DTO */
  user: VoicePresenceUserDto & { isVideoEnabled?: boolean };
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
  const { shouldUseTouchUI } = useResponsive();

  const longPress = useLongPress(
    (point) => {
      if (point) {
        onContextMenu(
          { preventDefault: () => {}, clientX: point.x, clientY: point.y } as React.MouseEvent<HTMLElement>,
          user,
        );
      }
    },
    { enabled: shouldUseTouchUI },
  );

  const interactionProps = shouldUseTouchUI
    ? {
        onTouchStart: longPress.onTouchStart,
        onTouchMove: longPress.onTouchMove,
        onTouchEnd: longPress.onTouchEnd,
        onTouchCancel: longPress.onTouchCancel,
        onContextMenu: longPress.onContextMenu,
      }
    : { onContextMenu: (e: React.MouseEvent<HTMLElement>) => onContextMenu(e, user) };

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
        onClick={() => {
          // Ignore the post-long-press ghost click (iOS) so the profile
          // doesn't open on top of the moderation menu.
          if (longPress.isLongPressTriggered()) return;
          onClickUser(user.id);
        }}
        {...interactionProps}
      >
        <UserAvatar userId={user.id} size="small" />
      </Box>
    </Tooltip>
  );
};

export default InlineUserAvatar;
