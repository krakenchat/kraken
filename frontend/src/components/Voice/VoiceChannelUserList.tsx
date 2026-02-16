import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  Mic,
  MicOff,
  Videocam,
  ScreenShare,
  VolumeOff,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { voicePresenceControllerGetChannelPresenceOptions } from "../../api-client/@tanstack/react-query.gen";
import type { VoicePresenceUserDto } from "../../api-client/types.gen";
import { formatDistanceToNow } from "date-fns";
import { Channel } from "../../types/channel.type";
import { ChannelType } from "../../types/channel.type";
import { useSpeakingDetection } from "../../hooks/useSpeakingDetection";
import { useParticipantTracks } from "../../hooks/useParticipantTracks";
import UserAvatar from "../Common/UserAvatar";
import { useVoiceConnection } from "../../hooks/useVoiceConnection";
import { useUserProfile } from "../../contexts/UserProfileContext";
import VoiceUserContextMenu from "./VoiceUserContextMenu";
import { RoomEvent, Participant } from "livekit-client";

interface VoiceChannelUserListProps {
  channel: Channel;
  showInline?: boolean;
  showDiscordStyle?: boolean;
}

export const VoiceChannelUserList: React.FC<VoiceChannelUserListProps> = ({
  channel,
  showInline = false,
  showDiscordStyle = false,
}) => {
  const theme = useTheme();
  const { state: voiceState } = useVoiceConnection();
  const [livekitParticipants, setLivekitParticipants] = useState<VoicePresenceUserDto[]>([]);
  const { openProfile } = useUserProfile();
  const [contextMenu, setContextMenu] = useState<{
    anchorEl: HTMLElement | null;
    user: VoicePresenceUserDto | null;
  }>({ anchorEl: null, user: null });

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>, user: VoicePresenceUserDto) => {
    event.preventDefault();
    setContextMenu({ anchorEl: event.currentTarget, user });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ anchorEl: null, user: null });
  };

  // Check if we're connected to this specific channel
  const isConnectedToThisChannel = voiceState.currentChannelId === channel.id && voiceState.isConnected;

  // Use backend presence query only when NOT connected to this channel
  // (for viewing other voice channels we're not in)
  const {
    data: backendPresence,
    isLoading: backendLoading,
    error: backendError,
  } = useQuery({
    ...voicePresenceControllerGetChannelPresenceOptions({ path: { channelId: channel.id } }),
    enabled: channel.type === ChannelType.VOICE && !isConnectedToThisChannel,
    refetchInterval: 30_000,
  });

  // Hook for real-time speaking detection via LiveKit
  const { isSpeaking } = useSpeakingDetection();

  // When connected to this channel, get participants directly from LiveKit
  useEffect(() => {
    if (!isConnectedToThisChannel || !voiceState.room) {
      setLivekitParticipants([]);
      return;
    }

    const room = voiceState.room;

    const updateParticipants = () => {
      const participants: VoicePresenceUserDto[] = [];

      // Add local participant
      const local = room.localParticipant;
      if (local && local.identity) {
        participants.push({
          id: local.identity,
          username: local.name || local.identity,
          displayName: local.name || undefined,
          avatarUrl: local.metadata ? JSON.parse(local.metadata).avatarUrl : undefined,
          joinedAt: new Date().toISOString(), // LiveKit doesn't track join time, use now
          isDeafened: false, // Will be updated by component
        });
      }

      // Add remote participants
      room.remoteParticipants.forEach((participant: Participant) => {
        let metadata: { avatarUrl?: string } = {};
        try {
          if (participant.metadata) {
            metadata = JSON.parse(participant.metadata);
          }
        } catch {
          // Ignore parse errors
        }

        participants.push({
          id: participant.identity,
          username: participant.name || participant.identity,
          displayName: participant.name || undefined,
          avatarUrl: metadata.avatarUrl,
          joinedAt: new Date().toISOString(),
          isDeafened: false,
        });
      });

      setLivekitParticipants(participants);
    };

    // Initial update
    updateParticipants();

    // Listen for participant changes
    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    room.on(RoomEvent.Connected, updateParticipants);

    return () => {
      room.off(RoomEvent.ParticipantConnected, updateParticipants);
      room.off(RoomEvent.ParticipantDisconnected, updateParticipants);
      room.off(RoomEvent.Connected, updateParticipants);
    };
  }, [isConnectedToThisChannel, voiceState.room]);

  // Determine which data source to use
  const presence = isConnectedToThisChannel
    ? { channelId: channel.id, users: livekitParticipants, count: livekitParticipants.length }
    : backendPresence;
  const isLoading = !isConnectedToThisChannel && backendLoading;
  const error = !isConnectedToThisChannel && backendError;

  if (channel.type !== ChannelType.VOICE) {
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Loading voice channel...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="error">
          Failed to load voice channel users
        </Typography>
      </Box>
    );
  }

  if (!presence || presence.users.length === 0) {
    return null;
  }

  const DiscordStyleUserItem: React.FC<{
    user: (typeof presence.users)[0];
  }> = React.memo(({ user }) => {
    // Real-time speaking detection from LiveKit
    const speaking = isSpeaking(user.id);

    // Get LiveKit state for this user (if they're in the room)
    const livekitState = useParticipantTracks(user.id);

    // Prefer LiveKit state if participant is in room, otherwise use server state
    const userState = {
      isMuted: livekitState.participant
        ? !livekitState.isMicrophoneEnabled
        : Boolean(user.isMuted),
      isDeafened: Boolean(user.isDeafened), // Custom state - only in server
      isVideoEnabled: livekitState.participant
        ? livekitState.isCameraEnabled
        : Boolean(user.isVideoEnabled),
      isScreenSharing: livekitState.participant
        ? livekitState.isScreenShareEnabled
        : Boolean(user.isScreenSharing),
    };
    
    return (
      <ListItem
        sx={{
          px: 1,
          py: 0.5,
          pl: 4, // Indent under voice channel like Discord
          minHeight: 40,
          cursor: "pointer",
          "&:hover": {
            backgroundColor: theme.palette.semantic.overlay.light,
          },
        }}
        onClick={() => openProfile(user.id)}
        onContextMenu={(e) => handleContextMenu(e, user)}
      >
        <ListItemAvatar sx={{ minWidth: 40 }}>
          <Box sx={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Box
              sx={{
                border: speaking ? `2px solid ${theme.palette.semantic.status.positive}` : "2px solid transparent",
                transition: "border-color 0.2s ease",
                borderRadius: "50%",
              }}
            >
              <UserAvatar user={user} size="small" />
            </Box>
            
            {/* Audio status badge - Discord-style (deafen takes priority over mute) */}
            {userState.isDeafened ? (
              <Box
                sx={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  backgroundColor: theme.palette.semantic.status.negative,
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid",
                  borderColor: "background.paper",
                }}
              >
                <VolumeOff sx={{ fontSize: 10, color: "white" }} />
              </Box>
            ) : userState.isMuted ? (
              <Box
                sx={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  backgroundColor: theme.palette.semantic.status.negative,
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid",
                  borderColor: "background.paper",
                }}
              >
                <MicOff sx={{ fontSize: 10, color: "white" }} />
              </Box>
            ) : null}
          </Box>
        </ListItemAvatar>

        <ListItemText
          primary={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 500,
                  color: userState.isMuted ? "text.secondary" : "text.primary",
                  fontSize: "14px"
                }}
              >
                {user.displayName || user.username}
              </Typography>
              
              {/* Status indicators - Discord-style (deafen takes priority over mute) */}
              <Box sx={{ display: "flex", gap: 0.5, ml: "auto", alignItems: "center" }}>

                {/* Deafened state takes priority over muted */}
                {userState.isDeafened ? (
                  <Tooltip title="Deafened">
                    <VolumeOff sx={{ fontSize: 16, color: theme.palette.semantic.status.negative }} />
                  </Tooltip>
                ) : userState.isMuted ? (
                  <Tooltip title="Muted">
                    <MicOff sx={{ fontSize: 16, color: theme.palette.semantic.status.negative }} />
                  </Tooltip>
                ) : null}

                {/* Video enabled state */}
                {userState.isVideoEnabled && (
                  <Tooltip title="Camera">
                    <Videocam sx={{ fontSize: 16, color: theme.palette.semantic.status.positive }} />
                  </Tooltip>
                )}

                {/* Screen sharing state */}
                {userState.isScreenSharing && (
                  <Tooltip title="Screen Share">
                    <ScreenShare sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                  </Tooltip>
                )}
              </Box>
            </Box>
          }
        />
      </ListItem>
    );
  });

  const UserItem: React.FC<{
    user: (typeof presence.users)[0];
    index: number;
  }> = React.memo(({ user, index }) => {
    // Get LiveKit state for this user (if they're in the room)
    const livekitState = useParticipantTracks(user.id);

    // Prefer LiveKit state if participant is in room, otherwise use server state
    const isMuted = livekitState.participant
      ? !livekitState.isMicrophoneEnabled
      : Boolean(user.isMuted);
    const isDeafened = Boolean(user.isDeafened); // Custom state - only in server
    const isVideoEnabled = livekitState.participant
      ? livekitState.isCameraEnabled
      : Boolean(user.isVideoEnabled);
    const isScreenSharing = livekitState.participant
      ? livekitState.isScreenShareEnabled
      : Boolean(user.isScreenSharing);

    const statusIcons = [];

    if (isMuted) statusIcons.push(<MicOff key="muted" fontSize="small" />);
    else statusIcons.push(<Mic key="mic" fontSize="small" />);

    if (isDeafened)
      statusIcons.push(<VolumeOff key="deafened" fontSize="small" />);
    if (isVideoEnabled)
      statusIcons.push(<Videocam key="video" fontSize="small" />);
    if (isScreenSharing)
      statusIcons.push(<ScreenShare key="screen" fontSize="small" />);

    const joinedAgo = formatDistanceToNow(new Date(user.joinedAt), {
      addSuffix: true,
    });

    return (
      <React.Fragment key={user.id}>
        <ListItem
          sx={{
            px: showInline ? 1 : 2,
            py: 1,
            cursor: "pointer",
            "&:hover": {
              backgroundColor: "action.hover",
            },
          }}
          onClick={() => openProfile(user.id)}
          onContextMenu={(e) => handleContextMenu(e, user)}
        >
          <ListItemAvatar>
            <UserAvatar user={user} size="small" />
          </ListItemAvatar>

          <ListItemText
            primary={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" fontWeight="medium">
                  {user.displayName || user.username}
                </Typography>
                <Box
                  sx={{ display: "flex", gap: 0.5, color: "text.secondary" }}
                >
                  {statusIcons.map((icon, i) => (
                    <Box key={i} sx={{ display: "flex", alignItems: "center" }}>
                      {icon}
                    </Box>
                  ))}
                </Box>
              </Box>
            }
            secondary={
              !showInline && (
                <Typography variant="caption" color="text.secondary">
                  Joined {joinedAgo}
                </Typography>
              )
            }
          />
        </ListItem>
        {index < presence.users.length - 1 && <Divider />}
      </React.Fragment>
    );
  });

  // Inline avatar display with video indicator
  const InlineUserAvatar: React.FC<{ user: (typeof presence.users)[0] }> = ({ user }) => {
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
          onClick={() => openProfile(user.id)}
          onContextMenu={(e) => handleContextMenu(e, user)}
        >
          <UserAvatar user={user} size="small" />
        </Box>
      </Tooltip>
    );
  };

  if (showInline) {
    return (
      <>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexWrap: "wrap",
          }}
        >
          {presence.users.slice(0, 3).map((user) => (
            <InlineUserAvatar key={user.id} user={user} />
          ))}
          {presence.users.length > 3 && (
            <Chip
              label={`+${presence.users.length - 3}`}
              size="small"
              sx={{ height: 24, fontSize: "0.75rem" }}
            />
          )}
        </Box>
        {contextMenu.user && (
          <VoiceUserContextMenu
            anchorEl={contextMenu.anchorEl}
            open={Boolean(contextMenu.anchorEl)}
            onClose={handleCloseContextMenu}
            user={contextMenu.user}
            communityId={channel.communityId}
            onViewProfile={() => openProfile(contextMenu.user!.id)}
          />
        )}
      </>
    );
  }

  // Discord-style nested display under voice channels
  if (showDiscordStyle) {
    return (
      <>
        <Box>
          {presence.users.map((user) => (
            <DiscordStyleUserItem key={user.id} user={user} />
          ))}
        </Box>
        {contextMenu.user && (
          <VoiceUserContextMenu
            anchorEl={contextMenu.anchorEl}
            open={Boolean(contextMenu.anchorEl)}
            onClose={handleCloseContextMenu}
            user={contextMenu.user}
            communityId={channel.communityId}
            onViewProfile={() => openProfile(contextMenu.user!.id)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          maxHeight: 300,
          overflow: "auto",
          "&::-webkit-scrollbar": {
            width: 6,
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: theme.palette.semantic.overlay.heavy,
            borderRadius: 3,
          },
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="h6" gutterBottom>
            Voice Channel — {presence.count}{" "}
            {presence.count === 1 ? "user" : "users"}
          </Typography>
        </Box>

        <List disablePadding>
          {presence.users.map((user, index) => (
            <UserItem key={user.id} user={user} index={index} />
          ))}
        </List>
      </Paper>
      {contextMenu.user && (
        <VoiceUserContextMenu
          anchorEl={contextMenu.anchorEl}
          open={Boolean(contextMenu.anchorEl)}
          onClose={handleCloseContextMenu}
          user={contextMenu.user}
          communityId={channel.communityId}
          onViewProfile={() => openProfile(contextMenu.user!.id)}
        />
      )}
    </>
  );
};
