import { createAsyncThunk } from "@reduxjs/toolkit";
import { Room } from "livekit-client";
import { Socket } from "socket.io-client";
import { RootState } from "../../app/store";
import {
  setConnecting,
  setConnected,
  setDmConnected,
  setDisconnected,
  setConnectionError,
  setAudioEnabled,
  setVideoEnabled,
  setScreenSharing,
  setMuted,
  setDeafened,
  setSelectedAudioInputId,
  setSelectedAudioOutputId,
  setSelectedVideoInputId,
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
    if (newState) {
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: true, // Enable system audio capture (works in Electron)
        resolution: {
          frameRate: 60,
        },
        preferCurrentTab: false,
      });
    } else {
      await room.localParticipant.setScreenShareEnabled(false);
    }
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
    const { isDeafened, isMuted, currentChannelId } = state.voice;

    if (!currentChannelId) return;

    const newDeafenedState = !isDeafened;

    try {
      dispatch(setDeafened(newDeafenedState));

      // When deafening, automatically mute as well (Discord-style)
      if (newDeafenedState && !isMuted) {
        dispatch(setMuted(true));
      }
      // Note: When undeafening, we keep the current mute state

      // Update server state
      await dispatch(
        voicePresenceApi.endpoints.updateVoiceState.initiate({
          channelId: currentChannelId,
          updates: {
            isDeafened: newDeafenedState,
            // If deafening, also send muted as true
            ...(newDeafenedState && !isMuted && { isMuted: true }),
          },
        })
      ).unwrap();
    } catch (error) {
      console.error("Failed to toggle deafen:", error);
      // Revert local state on failure
      dispatch(setDeafened(isDeafened));
      if (newDeafenedState && !isMuted) {
        dispatch(setMuted(isMuted));
      }
      throw error;
    }
  }
);

// Device switching thunks
export const switchAudioInputDevice = createAsyncThunk<
  void,
  { deviceId: string; getRoom: () => Room | null },
  { state: RootState }
>(
  "voice/switchAudioInputDevice",
  async ({ deviceId, getRoom }, { dispatch, getState }) => {
    const state = getState();
    const { currentChannelId } = state.voice;
    const room = getRoom();

    if (!room || !currentChannelId) return;

    try {
      // Switch the microphone device
      await room.switchActiveDevice('audioinput', deviceId);
      
      // Update Redux state
      dispatch(setSelectedAudioInputId(deviceId));
      
      console.log(`Switched audio input device to: ${deviceId}`);
    } catch (error) {
      console.error("Failed to switch audio input device:", error);
      throw error;
    }
  }
);

export const switchAudioOutputDevice = createAsyncThunk<
  void,
  { deviceId: string; getRoom: () => Room | null },
  { state: RootState }
>(
  "voice/switchAudioOutputDevice",
  async ({ deviceId, getRoom }, { dispatch, getState }) => {
    const state = getState();
    const { currentChannelId } = state.voice;
    const room = getRoom();

    if (!room || !currentChannelId) return;

    try {
      // Switch the audio output device
      await room.switchActiveDevice('audiooutput', deviceId);
      
      // Update Redux state
      dispatch(setSelectedAudioOutputId(deviceId));
      
      console.log(`Switched audio output device to: ${deviceId}`);
    } catch (error) {
      console.error("Failed to switch audio output device:", error);
      throw error;
    }
  }
);

export const switchVideoInputDevice = createAsyncThunk<
  void,
  { deviceId: string; getRoom: () => Room | null },
  { state: RootState }
>(
  "voice/switchVideoInputDevice",
  async ({ deviceId, getRoom }, { dispatch, getState }) => {
    const state = getState();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { currentChannelId, isVideoEnabled } = state.voice;
    const room = getRoom();

    if (!room || !currentChannelId) return;

    try {
      // Switch the video input device
      await room.switchActiveDevice('videoinput', deviceId);

      // Update Redux state
      dispatch(setSelectedVideoInputId(deviceId));

      console.log(`Switched video input device to: ${deviceId}`);
    } catch (error) {
      console.error("Failed to switch video input device:", error);
      throw error;
    }
  }
);

// =============================================================================
// DM VOICE THUNKS
// =============================================================================

interface JoinDmVoiceParams {
  dmGroupId: string;
  dmGroupName: string;
  user: { id: string; username: string; displayName?: string };
  connectionInfo: { url: string };
  socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
  setRoom: (room: Room | null) => void;
}

export const joinDmVoice = createAsyncThunk<
  void,
  JoinDmVoiceParams,
  { state: RootState }
>(
  "voice/joinDmVoice",
  async (
    {
      dmGroupId,
      dmGroupName,
      user,
      setRoom,
    },
    { dispatch }
  ) => {
    try {
      dispatch(setConnecting(true));

      // Generate LiveKit token for DM
      const tokenResponse = await dispatch(
        livekitApi.endpoints.generateDmToken.initiate({
          roomId: dmGroupId,
          identity: user.id,
          name: user.displayName || user.username,
        })
      ).unwrap();

      // Join DM voice on backend
      await dispatch(
        voicePresenceApi.endpoints.joinDmVoice.initiate(dmGroupId)
      ).unwrap();

      // Create and connect to LiveKit room
      const room = new Room();
      await room.connect(connectionInfo.url, tokenResponse.token);

      // Store room in external manager
      setRoom(room);

      dispatch(
        setDmConnected({
          dmGroupId,
          dmGroupName,
        })
      );

      // WebSocket notification handled by backend (DM_VOICE_CALL_STARTED or DM_VOICE_USER_JOINED)
    } catch (error) {
      console.error("Failed to join DM voice call:", error);
      const message =
        error instanceof Error ? error.message : "Failed to join DM voice call";
      dispatch(setConnectionError(message));

      // Clean up any partial state
      setRoom(null);
      throw error;
    }
  }
);

export const leaveDmVoice = createAsyncThunk<
  void,
  {
    socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
    getRoom: () => Room | null;
    setRoom: (room: Room | null) => void;
  },
  { state: RootState }
>(
  "voice/leaveDmVoice",
  async ({ getRoom, setRoom }, { dispatch, getState }) => {
    const state = getState();
    const { currentDmGroupId } = state.voice;
    const room = getRoom();

    if (!currentDmGroupId || !room) return;

    try {
      const dmGroupId = currentDmGroupId;

      // Disconnect from LiveKit room
      await room.disconnect();

      // Leave DM voice on backend
      await dispatch(
        voicePresenceApi.endpoints.leaveDmVoice.initiate(dmGroupId)
      ).unwrap();

      // Clear room reference
      setRoom(null);

      dispatch(setDisconnected());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to leave DM voice call";
      dispatch(setConnectionError(message));
      throw error;
    }
  }
);

// DM-specific toggle thunks (use DM API endpoints)
export const toggleDmAudio = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleDmAudio", async ({ getRoom }, { dispatch, getState }) => {
  const state = getState();
  const { isAudioEnabled, currentDmGroupId } = state.voice;
  const room = getRoom();

  if (!room || !currentDmGroupId) return;

  const newState = !isAudioEnabled;

  try {
    await room.localParticipant.setMicrophoneEnabled(newState);
    dispatch(setAudioEnabled(newState));

    await dispatch(
      voicePresenceApi.endpoints.updateDmVoiceState.initiate({
        dmGroupId: currentDmGroupId,
        updates: { isMuted: !newState },
      })
    ).unwrap();
  } catch (error) {
    console.error("Failed to toggle DM audio:", error);
    throw error;
  }
});

export const toggleDmVideo = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleDmVideo", async ({ getRoom }, { dispatch, getState }) => {
  const state = getState();
  const { isVideoEnabled, currentDmGroupId } = state.voice;
  const room = getRoom();

  if (!room || !currentDmGroupId) return;

  const newState = !isVideoEnabled;

  try {
    await room.localParticipant.setCameraEnabled(newState);
    dispatch(setVideoEnabled(newState));

    await dispatch(
      voicePresenceApi.endpoints.updateDmVoiceState.initiate({
        dmGroupId: currentDmGroupId,
        updates: { isVideoEnabled: newState },
      })
    ).unwrap();
  } catch (error) {
    console.error("Failed to toggle DM video:", error);
    throw error;
  }
});

export const toggleDmScreenShare = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleDmScreenShare", async ({ getRoom }, { dispatch, getState }) => {
  const state = getState();
  const { isScreenSharing, currentDmGroupId, isMuted, isDeafened, isVideoEnabled } = state.voice;
  const room = getRoom();

  if (!room || !currentDmGroupId) return;

  const newState = !isScreenSharing;

  try {
    dispatch(setScreenSharing(newState));

    await dispatch(
      voicePresenceApi.endpoints.updateDmVoiceState.initiate({
        dmGroupId: currentDmGroupId,
        updates: {
          isScreenSharing: newState,
          isMuted,
          isDeafened,
          isVideoEnabled
        },
      })
    ).unwrap();

    if (newState) {
      // Enable screen share with high quality: native resolution, 60fps, with audio
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: true,  // Capture system/tab audio
        resolution: {
          frameRate: 60,  // 60fps for smooth motion (uses native width/height)
        },
        preferCurrentTab: false,  // Allow selection of screen/window/tab
      });
    } else {
      // Disable screen share
      await room.localParticipant.setScreenShareEnabled(false);
    }
  } catch (error) {
    console.error("Failed to toggle DM screen share:", error);
    dispatch(setScreenSharing(isScreenSharing));
    throw error;
  }
});

export const toggleDmMute = createAsyncThunk<void, void, { state: RootState }>(
  "voice/toggleDmMute",
  async (_, { dispatch, getState }) => {
    const state = getState();
    const { isMuted, currentDmGroupId } = state.voice;

    if (!currentDmGroupId) return;

    const newMutedState = !isMuted;

    try {
      dispatch(setMuted(newMutedState));

      await dispatch(
        voicePresenceApi.endpoints.updateDmVoiceState.initiate({
          dmGroupId: currentDmGroupId,
          updates: { isMuted: newMutedState },
        })
      ).unwrap();
    } catch (error) {
      console.error("Failed to toggle DM mute:", error);
      dispatch(setMuted(isMuted));
      throw error;
    }
  }
);

export const toggleDmDeafen = createAsyncThunk<void, void, { state: RootState }>(
  "voice/toggleDmDeafen",
  async (_, { dispatch, getState }) => {
    const state = getState();
    const { isDeafened, isMuted, currentDmGroupId } = state.voice;

    if (!currentDmGroupId) return;

    const newDeafenedState = !isDeafened;

    try {
      dispatch(setDeafened(newDeafenedState));

      // When deafening, automatically mute as well (Discord-style)
      if (newDeafenedState && !isMuted) {
        dispatch(setMuted(true));
      }

      await dispatch(
        voicePresenceApi.endpoints.updateDmVoiceState.initiate({
          dmGroupId: currentDmGroupId,
          updates: {
            isDeafened: newDeafenedState,
            ...(newDeafenedState && !isMuted && { isMuted: true }),
          },
        })
      ).unwrap();
    } catch (error) {
      console.error("Failed to toggle DM deafen:", error);
      dispatch(setDeafened(isDeafened));
      if (newDeafenedState && !isMuted) {
        dispatch(setMuted(isMuted));
      }
      throw error;
    }
  }
);
