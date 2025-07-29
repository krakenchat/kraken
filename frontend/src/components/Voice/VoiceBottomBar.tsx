import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  Menu,
  MenuItem,
  Badge,
  Collapse,
} from "@mui/material";
import {
  Mic,
  MicOff,
  Headset,
  HeadsetOff,
  Videocam,
  VideocamOff,
  ScreenShare,
  StopScreenShare,
  CallEnd,
  Settings,
  ExpandLess,
  ExpandMore,
  VolumeUp,
} from "@mui/icons-material";
import { useVoiceConnection } from "../../hooks/useVoiceConnection";
import { VoiceChannelUserList } from "./VoiceChannelUserList";
import { ChannelType } from "../../types/channel.type";

export const VoiceBottomBar: React.FC = () => {
  const { state, actions } = useVoiceConnection();
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(
    null
  );
  const [showUserList, setShowUserList] = useState(false);

  if (!state.isConnected || !state.currentChannelId) {
    return null;
  }

  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchor(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchor(null);
  };

  const handleToggleVideo = () => {
    actions.toggleVideo();
    if (!state.isVideoEnabled) {
      actions.setShowVideoTiles(true);
    }
  };

  return (
    <>
      {/* User List Expansion */}
      <Collapse in={showUserList} timeout={300}>
        <Box
          sx={{
            position: "fixed",
            bottom: 80,
            left: 0,
            right: 0,
            zIndex: 1200,
            display: "flex",
            justifyContent: "center",
            px: 2,
          }}
        >
          <Box sx={{ maxWidth: 400, width: "100%" }}>
            <VoiceChannelUserList
              channel={{
                id: state.currentChannelId,
                name: state.channelName || "Voice Channel",
                type: ChannelType.VOICE,
                communityId: state.communityId || "",
                isPrivate: state.isPrivate ?? false,
                createdAt: state.createdAt || "",
              }}
            />
          </Box>
        </Box>
      </Collapse>

      {/* Main Bottom Bar */}
      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          borderRadius: 0,
          backgroundColor: "background.paper",
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 1.5,
            minHeight: 64,
          }}
        >
          {/* Channel Info */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <VolumeUp color="primary" />
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {state.channelName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Voice Connected
                </Typography>
              </Box>
            </Box>

            {/* Connection Status */}
            <Chip
              label={state.isConnected ? "Connected" : "Connecting..."}
              color={state.isConnected ? "success" : "warning"}
              size="small"
              sx={{ height: 24 }}
            />

            {/* Participants Count */}
            <Tooltip title="Show participants">
              <IconButton
                size="small"
                onClick={() => setShowUserList(!showUserList)}
                sx={{
                  backgroundColor: showUserList
                    ? "action.selected"
                    : "transparent",
                }}
              >
                <Badge badgeContent={state.participants.length} color="primary">
                  {showUserList ? <ExpandMore /> : <ExpandLess />}
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>

          {/* Voice Controls */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {/* Microphone */}
            <Tooltip title={state.isMuted ? "Unmute" : "Mute"}>
              <IconButton
                onClick={actions.toggleMute}
                color={state.isMuted ? "error" : "default"}
                sx={{
                  backgroundColor: state.isMuted ? "error.main" : "transparent",
                  color: state.isMuted ? "error.contrastText" : "text.primary",
                  "&:hover": {
                    backgroundColor: state.isMuted
                      ? "error.dark"
                      : "action.hover",
                  },
                }}
              >
                {state.isMuted ? <MicOff /> : <Mic />}
              </IconButton>
            </Tooltip>

            {/* Headphones/Deafen */}
            <Tooltip title={state.isDeafened ? "Undeafen" : "Deafen"}>
              <IconButton
                onClick={actions.toggleDeafen}
                color={state.isDeafened ? "error" : "default"}
                sx={{
                  backgroundColor: state.isDeafened
                    ? "error.main"
                    : "transparent",
                  color: state.isDeafened
                    ? "error.contrastText"
                    : "text.primary",
                  "&:hover": {
                    backgroundColor: state.isDeafened
                      ? "error.dark"
                      : "action.hover",
                  },
                }}
              >
                {state.isDeafened ? <HeadsetOff /> : <Headset />}
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* Video */}
            <Tooltip
              title={
                state.isVideoEnabled ? "Turn off camera" : "Turn on camera"
              }
            >
              <IconButton
                onClick={handleToggleVideo}
                color={state.isVideoEnabled ? "primary" : "default"}
                sx={{
                  backgroundColor: state.isVideoEnabled
                    ? "primary.main"
                    : "transparent",
                  color: state.isVideoEnabled
                    ? "primary.contrastText"
                    : "text.primary",
                  "&:hover": {
                    backgroundColor: state.isVideoEnabled
                      ? "primary.dark"
                      : "action.hover",
                  },
                }}
              >
                {state.isVideoEnabled ? <Videocam /> : <VideocamOff />}
              </IconButton>
            </Tooltip>

            {/* Screen Share */}
            <Tooltip
              title={
                state.isScreenSharing ? "Stop screen share" : "Share screen"
              }
            >
              <IconButton
                onClick={actions.toggleScreenShare}
                color={state.isScreenSharing ? "primary" : "default"}
                sx={{
                  backgroundColor: state.isScreenSharing
                    ? "primary.main"
                    : "transparent",
                  color: state.isScreenSharing
                    ? "primary.contrastText"
                    : "text.primary",
                  "&:hover": {
                    backgroundColor: state.isScreenSharing
                      ? "primary.dark"
                      : "action.hover",
                  },
                }}
              >
                {state.isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* Settings */}
            <Tooltip title="Voice settings">
              <IconButton onClick={handleSettingsClick}>
                <Settings />
              </IconButton>
            </Tooltip>

            {/* Disconnect */}
            <Tooltip title="Disconnect">
              <IconButton
                onClick={actions.leaveVoiceChannel}
                color="error"
                sx={{
                  "&:hover": {
                    backgroundColor: "error.main",
                    color: "error.contrastText",
                  },
                }}
              >
                <CallEnd />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Settings Menu */}
        <Menu
          anchorEl={settingsAnchor}
          open={Boolean(settingsAnchor)}
          onClose={handleSettingsClose}
          anchorOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
          transformOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
        >
          <MenuItem
            onClick={() => {
              actions.setShowVideoTiles(!state.showVideoTiles);
              handleSettingsClose();
            }}
          >
            {state.showVideoTiles ? "Hide Video Tiles" : "Show Video Tiles"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              // TODO: Add audio device selection
              handleSettingsClose();
            }}
          >
            Audio Settings
          </MenuItem>
          <MenuItem
            onClick={() => {
              // TODO: Add video device selection
              handleSettingsClose();
            }}
          >
            Video Settings
          </MenuItem>
        </Menu>
      </Paper>
    </>
  );
};
