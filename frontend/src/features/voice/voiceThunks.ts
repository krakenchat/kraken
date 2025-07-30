import { createAsyncThunk } from "@reduxjs/toolkit";
import { Room } from "livekit-client";
import { Socket } from "socket.io-client";
import { RootState } from "../../app/store";
import {
  setConnecting,
  setConnected,
  setDisconnected,
  setConnectionError,
  setAudioEnabled,
  setVideoEnabled,
  setScreenSharing,
  setMuted,
  setDeafened,
} from "./voiceSlice";
import { voicePresenceApi } from "../voice-presence/voicePresenceApiSlice";
import { livekitApi } from "../livekit/livekitApiSlice";
import { ClientEvents } from "../../types/client-events.enum";
import {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../../utils/SocketContext";

interface JoinVoiceChannelParams {
  channelId: string;
  channelName: string;
  communityId: string;
  isPrivate: boolean;
  createdAt: string;
  user: { id: string; username: string; displayName?: string };
  connectionInfo: { url: string };
  socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
  setRoom: (room: Room | null) => void;
}

export const joinVoiceChannel = createAsyncThunk<
  void,
  JoinVoiceChannelParams,
  { state: RootState }
>(
  "voice/joinChannel",
  async (
    {
      channelId,
      channelName,
      communityId,
      isPrivate,
      createdAt,
      user,
      connectionInfo,
      socket,
      setRoom,
    },
    { dispatch }
  ) => {
    try {
      dispatch(setConnecting(true));

      // Generate LiveKit token
      const tokenResponse = await dispatch(
        livekitApi.endpoints.generateToken.initiate({
          roomId: channelId,
          identity: user.id,
          name: user.displayName || user.username,
        })
      ).unwrap();

      // Join voice channel on backend
      await dispatch(
        voicePresenceApi.endpoints.joinVoiceChannel.initiate(channelId)
      ).unwrap();

      // Create and connect to LiveKit room
      const room = new Room();
      await room.connect(connectionInfo.url, tokenResponse.token);

      // Store room in external manager
      setRoom(room);

      dispatch(
        setConnected({
          channelId,
          channelName,
          communityId,
          isPrivate,
          createdAt,
        })
      );

      // Notify via WebSocket
      if (socket) {
        socket.emit(ClientEvents.VOICE_CHANNEL_JOIN, { channelId });
      }
    } catch (error) {
      console.error("Failed to join voice channel:", error);
      const message =
        error instanceof Error ? error.message : "Failed to join voice channel";
      dispatch(setConnectionError(message));
      
      // Clean up any partial state
      setRoom(null);
      throw error;
    }
  }
);

export const leaveVoiceChannel = createAsyncThunk<
  void,
  {
    socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
    getRoom: () => Room | null;
    setRoom: (room: Room | null) => void;
  },
  { state: RootState }
>(
  "voice/leaveChannel",
  async ({ socket, getRoom, setRoom }, { dispatch, getState }) => {
    const state = getState();
    const { currentChannelId } = state.voice;
    const room = getRoom();

    if (!currentChannelId || !room) return;

    try {
      const channelId = currentChannelId;

      // Disconnect from LiveKit room
      await room.disconnect();

      // Leave voice channel on backend
      await dispatch(
        voicePresenceApi.endpoints.leaveVoiceChannel.initiate(channelId)
      ).unwrap();

      // Notify via WebSocket
      if (socket) {
        socket.emit(ClientEvents.VOICE_CHANNEL_LEAVE, { channelId });
      }

      // Clear room reference
      setRoom(null);

      dispatch(setDisconnected());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to leave voice channel";
      dispatch(setConnectionError(message));
      throw error;
    }
  }
);

export const toggleAudio = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleAudio", async ({ getRoom }, { dispatch, getState }) => {
  const state = getState();
  const { isAudioEnabled, currentChannelId } = state.voice;
  const room = getRoom();

  if (!room || !currentChannelId) return;

  const newState = !isAudioEnabled;

  try {
    await room.localParticipant.setMicrophoneEnabled(newState);
    dispatch(setAudioEnabled(newState));

    // Update server state - muted is opposite of audio enabled
    await dispatch(
      voicePresenceApi.endpoints.updateVoiceState.initiate({
        channelId: currentChannelId,
        updates: { isMuted: !newState },
      })
    ).unwrap();
  } catch (error) {
    console.error("Failed to toggle audio:", error);
    throw error;
  }
});

export const toggleVideo = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleVideo", async ({ getRoom }, { dispatch, getState }) => {
  const state = getState();
  const { isVideoEnabled, currentChannelId } = state.voice;
  const room = getRoom();

  if (!room || !currentChannelId) return;

  const newState = !isVideoEnabled;

  try {
    await room.localParticipant.setCameraEnabled(newState);
    dispatch(setVideoEnabled(newState));

    // Update server state
    await dispatch(
      voicePresenceApi.endpoints.updateVoiceState.initiate({
        channelId: currentChannelId,
        updates: { isVideoEnabled: newState },
      })
    ).unwrap();
  } catch (error) {
    console.error("Failed to toggle video:", error);
    throw error;
  }
});

export const toggleScreenShare = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleScreenShare", async ({ getRoom }, { dispatch, getState }) => {
  const state = getState();
  const { isScreenSharing, currentChannelId, isMuted, isDeafened, isVideoEnabled } = state.voice;
  const room = getRoom();

  if (!room || !currentChannelId) return;

  const newState = !isScreenSharing;

  try {
    // Update Redux state first to ensure UI is responsive
    dispatch(setScreenSharing(newState));

    // Update server state with all current voice states to prevent clearing other states
    await dispatch(
      voicePresenceApi.endpoints.updateVoiceState.initiate({
        channelId: currentChannelId,
        updates: { 
          isScreenSharing: newState,
          isMuted,
          isDeafened, 
          isVideoEnabled
        },
      })
    ).unwrap();

    // Then handle the actual LiveKit screen share (this is the async part that prompts user)
    await room.localParticipant.setScreenShareEnabled(newState);
  } catch (error) {
    console.error("Failed to toggle screen share:", error);
    // Revert Redux state on failure
    dispatch(setScreenSharing(isScreenSharing));
    throw error;
  }
});

export const toggleMute = createAsyncThunk<void, void, { state: RootState }>(
  "voice/toggleMute",
  async (_, { dispatch, getState }) => {
    const state = getState();
    const { isMuted, currentChannelId } = state.voice;

    if (!currentChannelId) return;

    const newMutedState = !isMuted;

    try {
      dispatch(setMuted(newMutedState));

      // Update server state
      await dispatch(
        voicePresenceApi.endpoints.updateVoiceState.initiate({
          channelId: currentChannelId,
          updates: { isMuted: newMutedState },
        })
      ).unwrap();
    } catch (error) {
      console.error("Failed to toggle mute:", error);
      // Revert local state on failure
      dispatch(setMuted(isMuted));
      throw error;
    }
  }
);

export const toggleDeafen = createAsyncThunk<void, void, { state: RootState }>(
  "voice/toggleDeafen",
  async (_, { dispatch, getState }) => {
    const state = getState();
    const { isDeafened, currentChannelId } = state.voice;

    if (!currentChannelId) return;

    const newDeafenedState = !isDeafened;

    try {
      dispatch(setDeafened(newDeafenedState));

      // Update server state
      await dispatch(
        voicePresenceApi.endpoints.updateVoiceState.initiate({
          channelId: currentChannelId,
          updates: { isDeafened: newDeafenedState },
        })
      ).unwrap();
    } catch (error) {
      console.error("Failed to toggle deafen:", error);
      // Revert local state on failure
      dispatch(setDeafened(isDeafened));
      throw error;
    }
  }
);
