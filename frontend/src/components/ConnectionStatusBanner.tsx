import React from "react";
import { Chip, CircularProgress } from "@mui/material";
import { useSocketConnected } from "../hooks/useSocket";
import { useVoiceConnection } from "../hooks/useVoiceConnection";
import { useResponsive } from "../hooks/useResponsive";
import { VOICE_BAR_HEIGHT, VOICE_BAR_HEIGHT_MOBILE } from "../constants/layout";

export const ConnectionStatusBanner: React.FC = () => {
  const isConnected = useSocketConnected();
  const { state: voiceState } = useVoiceConnection();
  const { isMobile } = useResponsive();
  const voiceConnected = voiceState.isConnected && (voiceState.currentChannelId || voiceState.currentDmGroupId);
  const voiceBarHeight = isMobile ? VOICE_BAR_HEIGHT_MOBILE : VOICE_BAR_HEIGHT;

  if (isConnected) return null;

  return (
    <Chip
      icon={<CircularProgress size={14} color="inherit" />}
      label="Reconnecting..."
      size="small"
      sx={{
        position: "fixed",
        bottom: voiceConnected ? voiceBarHeight + 16 : 16,
        left: 16,
        zIndex: 9999,
        animation: "connectionPulse 2s ease-in-out infinite",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "warning.main",
        color: "warning.main",
        "@keyframes connectionPulse": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
        },
      }}
    />
  );
};
