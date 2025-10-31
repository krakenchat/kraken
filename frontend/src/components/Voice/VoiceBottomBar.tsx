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
import { DeviceSettingsDialog } from "./DeviceSettingsDialog";
import { VoiceDebugPanel } from "./VoiceDebugPanel";
import { ChannelType } from "../../types/channel.type";
import { useResponsive } from "../../hooks/useResponsive";
import { LAYOUT_CONSTANTS } from "../../utils/breakpoints";
import { useSpeakingDetection } from "../../hooks/useSpeakingDetection";
import { useProfileQuery } from "../../features/users/usersSlice";

export const VoiceBottomBar: React.FC = () => {
  const { state, actions } = useVoiceConnection();
  const { isMobile } = useResponsive();
  const { data: currentUser } = useProfileQuery();
  const { isSpeaking } = useSpeakingDetection();
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(
    null
  );
  const [showUserList, setShowUserList] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(true); // Default to true for testing

  // Check if the current user is speaking
  const isCurrentUserSpeaking = currentUser ? isSpeaking(currentUser.id) : false;

  // Keyboard shortcut to toggle debug panel (Ctrl+Shift+D)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        setShowDebugPanel((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show bar if connected to either a channel or DM
  if (!state.isConnected || (!state.currentChannelId && !state.currentDmGroupId)) {
    return null;
  }

  // Determine display name and type
  const displayName = state.contextType === 'dm'
    ? state.dmGroupName || 'Direct Message'
    : state.channelName || 'Voice Channel';

  const displayType = state.contextType === 'dm' ? 'DM Voice Call' : 'Voice Connected';

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeviceSettingsOpen = (_type?: 'audio' | 'video') => {
    setShowDeviceSettings(true);
    handleSettingsClose();
  };

  const handleDeviceSettingsClose = () => {
    setShowDeviceSettings(false);
  };

  const handleDeviceChange = async (type: 'audio' | 'video', deviceId: string) => {
    try {
      if (type === 'audio') {
        await actions.switchAudioInputDevice(deviceId);
      } else if (type === 'video') {
        await actions.switchVideoInputDevice(deviceId);
      }
      console.log(`Successfully switched ${type} device to: ${deviceId}`);
    } catch (error) {
      console.error(`Failed to switch ${type} device:`, error);
    }
  };

  return (
    <>
      {/* User List Expansion - only for channels */}
      {state.contextType === 'channel' && state.currentChannelId && (
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
      )}

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
            px: isMobile ? 1 : 3,
            py: isMobile ? 1 : 1.5,
            minHeight: isMobile ? LAYOUT_CONSTANTS.VOICE_BAR_HEIGHT_MOBILE : 64,
            gap: isMobile ? 0.5 : 1,
          }}
        >
          {/* Channel/DM Info */}
          <Box sx={{ display: "flex", alignItems: "center", gap: isMobile ? 0.5 : 2, flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <VolumeUp color="primary" sx={{ flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight="medium" noWrap>
                  {displayName}
                </Typography>
                {!isMobile && (
                  <Typography variant="caption" color="text.secondary">
                    {displayType}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Connection Status - hide on mobile */}
            {!isMobile && (
              <Chip
                label={state.isConnected ? "Connected" : "Connecting..."}
                color={state.isConnected ? "success" : "warning"}
                size="small"
                sx={{ height: 24 }}
              />
            )}

            {/* Participants Count - only for channels, hide on mobile */}
            {state.contextType === 'channel' && !isMobile && (
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
            )}
          </Box>

          {/* Voice Controls */}
          <Box sx={{ display: "flex", alignItems: "center", gap: isMobile ? 0.5 : 1 }}>
            {/* Microphone */}
            <Tooltip title={state.isMuted ? "Unmute" : "Mute"} arrow={!isMobile}>
              <IconButton
                onClick={actions.toggleMute}
                color={state.isMuted ? "error" : "default"}
                size={isMobile ? "medium" : "medium"}
                sx={{
                  backgroundColor: state.isMuted ? "error.main" : "transparent",
                  color: state.isMuted ? "error.contrastText" : "text.primary",
                  minWidth: isMobile ? 48 : "auto",
                  minHeight: isMobile ? 48 : "auto",
                  border: !state.isMuted && isCurrentUserSpeaking ? "2px solid #43b581" : "2px solid transparent",
                  boxShadow: !state.isMuted && isCurrentUserSpeaking ? "0 0 8px #43b581" : "none",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
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

            {/* Headphones/Deafen - hide on mobile */}
            {!isMobile && (
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
            )}

            <Divider orientation="vertical" flexItem sx={{ mx: isMobile ? 0.5 : 1 }} />

            {/* Video */}
            <Tooltip
              title={
                state.isVideoEnabled ? "Turn off camera" : "Turn on camera"
              }
              arrow={!isMobile}
            >
              <IconButton
                onClick={handleToggleVideo}
                color={state.isVideoEnabled ? "primary" : "default"}
                size={isMobile ? "medium" : "medium"}
                sx={{
                  backgroundColor: state.isVideoEnabled
                    ? "primary.main"
                    : "transparent",
                  color: state.isVideoEnabled
                    ? "primary.contrastText"
                    : "text.primary",
                  minWidth: isMobile ? 48 : "auto",
                  minHeight: isMobile ? 48 : "auto",
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
              arrow={!isMobile}
            >
              <IconButton
                onClick={actions.toggleScreenShare}
                color={state.isScreenSharing ? "primary" : "default"}
                size={isMobile ? "medium" : "medium"}
                sx={{
                  backgroundColor: state.isScreenSharing
                    ? "primary.main"
                    : "transparent",
                  color: state.isScreenSharing
                    ? "primary.contrastText"
                    : "text.primary",
                  minWidth: isMobile ? 48 : "auto",
                  minHeight: isMobile ? 48 : "auto",
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

            {/* Settings - hide on mobile, use menu instead */}
            {!isMobile && (
              <>
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                <Tooltip title="Voice settings">
                  <IconButton onClick={handleSettingsClick}>
                    <Settings />
                  </IconButton>
                </Tooltip>
              </>
            )}

            <Divider orientation="vertical" flexItem sx={{ mx: isMobile ? 0.5 : 1 }} />

            {/* Disconnect */}
            <Tooltip title="Disconnect" arrow={!isMobile}>
              <IconButton
                onClick={actions.leaveVoiceChannel}
                color="error"
                size={isMobile ? "medium" : "medium"}
                sx={{
                  minWidth: isMobile ? 48 : "auto",
                  minHeight: isMobile ? 48 : "auto",
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
          <MenuItem onClick={() => handleDeviceSettingsOpen('audio')}>
            Audio Settings
          </MenuItem>
          <MenuItem onClick={() => handleDeviceSettingsOpen('video')}>
            Video Settings
          </MenuItem>
        </Menu>

        {/* Device Settings Dialog */}
        <DeviceSettingsDialog
          open={showDeviceSettings}
          onClose={handleDeviceSettingsClose}
          onDeviceChange={handleDeviceChange}
        />
      </Paper>

      {/* Debug Panel - Toggle with Ctrl+Shift+D */}
      {showDebugPanel && <VoiceDebugPanel />}
    </>
  );
};
