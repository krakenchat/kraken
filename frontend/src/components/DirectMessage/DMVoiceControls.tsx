import React, { useState } from "react";
import { Box, IconButton, Tooltip, CircularProgress } from "@mui/material";
import { Phone, Videocam } from "@mui/icons-material";
import { useDmVoiceConnection } from "../../hooks/useDmVoiceConnection";

interface DMVoiceControlsProps {
  dmGroupId: string;
  dmGroupName: string;
}

export const DMVoiceControls: React.FC<DMVoiceControlsProps> = ({
  dmGroupId,
  dmGroupName,
}) => {
  const { state, actions } = useDmVoiceConnection();
  const [isJoining, setIsJoining] = useState(false);

  // Check if we're currently in this DM's voice call
  const isInThisDmCall =
    state.isConnected &&
    state.contextType === "dm" &&
    state.currentDmGroupId === dmGroupId;

  // Check if we're in any voice call (DM or channel)
  const isInAnyCall = state.isConnected;

  const handleStartVoiceCall = async () => {
    if (isInAnyCall) {
      // If already in a call, leave it first
      if (state.contextType === "dm") {
        await actions.leaveDmVoice();
      }
      // Don't handle channel calls here - let the user manually leave
      return;
    }

    setIsJoining(true);
    try {
      await actions.joinDmVoice(dmGroupId, dmGroupName);
    } catch (error) {
      console.error("Failed to join DM voice call:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartVideoCall = async () => {
    if (isInAnyCall) {
      // If already in a call, leave it first
      if (state.contextType === "dm") {
        await actions.leaveDmVoice();
      }
      return;
    }

    setIsJoining(true);
    try {
      // Join with audio first, then enable video
      await actions.joinDmVoice(dmGroupId, dmGroupName);
      await actions.toggleVideo();
      actions.setShowVideoTiles(true);
    } catch (error) {
      console.error("Failed to start DM video call:", error);
    } finally {
      setIsJoining(false);
    }
  };

  // If in this DM call, show active indicator (controls are in bottom bar)
  if (isInThisDmCall) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Tooltip title="In voice call">
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "success.main",
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.5 },
              },
            }}
          />
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {/* Voice Call Button */}
      <Tooltip
        title={
          isInAnyCall
            ? "Leave current call first"
            : "Start voice call"
        }
      >
        <span>
          <IconButton
            size="small"
            onClick={handleStartVoiceCall}
            disabled={isJoining || (isInAnyCall && !isInThisDmCall)}
            sx={{
              color: "text.secondary",
              "&:hover": {
                color: "primary.main",
                backgroundColor: "action.hover",
              },
            }}
          >
            {isJoining ? <CircularProgress size={20} /> : <Phone />}
          </IconButton>
        </span>
      </Tooltip>

      {/* Video Call Button */}
      <Tooltip
        title={
          isInAnyCall
            ? "Leave current call first"
            : "Start video call"
        }
      >
        <span>
          <IconButton
            size="small"
            onClick={handleStartVideoCall}
            disabled={isJoining || (isInAnyCall && !isInThisDmCall)}
            sx={{
              color: "text.secondary",
              "&:hover": {
                color: "primary.main",
                backgroundColor: "action.hover",
              },
            }}
          >
            {isJoining ? <CircularProgress size={20} /> : <Videocam />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
