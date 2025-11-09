import { createAsyncThunk, Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { Room, VideoCaptureOptions } from "livekit-client";
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
import { getScreenShareSettings, DEFAULT_SCREEN_SHARE_SETTINGS } from "../../utils/screenShareState";
import { getResolutionConfig, getScreenShareAudioConfig } from "../../utils/screenShareResolution";

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

/**
 * Shared helper to connect to LiveKit room and enable microphone
 * Used by both channel and DM voice joining
 */
async function connectToLiveKitRoom(
  url: string,
  token: string,
  setRoom: (room: Room | null) => void,
  dispatch: Dispatch<UnknownAction>
): Promise<Room> {
  const room = new Room();

  try {
    await room.connect(url, token);
    setRoom(room);
  } catch (error) {
    console.error('[Voice] ✗ Failed to connect to LiveKit room:', error);
    throw error;
  }

  // Enable microphone by default when joining
  try {
    await room.localParticipant.setMicrophoneEnabled(true);
    dispatch(setAudioEnabled(true));
  } catch (error) {
    console.error('[Voice] ✗ Failed to enable microphone:', error);
    // Keep state in sync - mic is disabled if it failed to enable
    dispatch(setAudioEnabled(false));
    // Don't fail the whole join if mic fails, just log it
  }

  return room;
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

      // Connect to LiveKit room and enable microphone
      await connectToLiveKitRoom(connectionInfo.url, tokenResponse.token, setRoom, dispatch);

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
      console.error("[Voice] ✗ Failed to join voice channel:", error);
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
    const { currentChannelId } = state.voice;
    const room = getRoom();

    if (!room || !currentChannelId) return;

    try {
      // Switch the video input device
      await room.switchActiveDevice('videoinput', deviceId);

      // Update Redux state
      dispatch(setSelectedVideoInputId(deviceId));
    } catch (error) {
      console.error("Failed to switch video input device:", error);
      throw error;
    }
  }
);

// =============================================================================
// DM VOICE THUNKS (Join/Leave only - media controls use unified thunks below)
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
      connectionInfo,
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

      // Connect to LiveKit room and enable microphone
      await connectToLiveKitRoom(connectionInfo.url, tokenResponse.token, setRoom, dispatch);

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

// =============================================================================
// UNIFIED THUNKS (NEW - REPLACES DUPLICATE CHANNEL/DM VERSIONS)
// =============================================================================

/**
 * Unified microphone toggle for both channels and DMs
 * Replaces: toggleAudio, toggleDmAudio, toggleMute, toggleDmMute
 *
 * This actually controls the LiveKit microphone track (fixes bug where toggleMute didn't affect LiveKit)
 */
export const toggleMicrophone = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleMicrophone", async ({ getRoom }, { dispatch, getState }) => {
  const state = getState();
  const { isAudioEnabled, currentChannelId, currentDmGroupId } = state.voice;
  const room = getRoom();

  if (!room || (!currentChannelId && !currentDmGroupId)) return;

  const newState = !isAudioEnabled;

  try {
    // First toggle LiveKit microphone
    await room.localParticipant.setMicrophoneEnabled(newState);
    dispatch(setAudioEnabled(newState));

    // Note: No longer sending mic state to server - LiveKit manages it
    // Server only stores custom UI state (isDeafened)
  } catch (error) {
    console.error("Failed to toggle microphone:", error);
    throw error;
  }
});

/**
 * Unified camera toggle for both channels and DMs
 * Replaces: toggleVideo, toggleDmVideo
 */
export const toggleCameraUnified = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleCameraUnified", async ({ getRoom }, { dispatch, getState }) => {
  const state = getState();
  const { isVideoEnabled, currentChannelId, currentDmGroupId, selectedVideoInputId } = state.voice;
  const room = getRoom();

  if (!room || (!currentChannelId && !currentDmGroupId)) {
    console.warn('Cannot toggle camera: no active room or channel/DM');
    return;
  }

  if (room.state !== 'connected') {
    console.error('Cannot toggle camera: room is not connected, state:', room.state);
    throw new Error('Room is not connected');
  }

  const newState = !isVideoEnabled;

  try {
    // Update local state first for responsive UI
    dispatch(setVideoEnabled(newState));

    // Prepare video capture options
    const videoCaptureOptions: VideoCaptureOptions | undefined = newState
      ? {
          deviceId: selectedVideoInputId ? { ideal: selectedVideoInputId } : undefined,
          resolution: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        }
      : undefined;

    // Toggle LiveKit camera
    await room.localParticipant.setCameraEnabled(newState, videoCaptureOptions);

    // Note: No longer sending video state to server - LiveKit manages it
  } catch (error) {
    console.error("Failed to toggle camera:", error);
    // Revert state on failure
    dispatch(setVideoEnabled(isVideoEnabled));
    throw error;
  }
});

/**
 * Unified screen share toggle for both channels and DMs
 * Replaces: toggleScreenShare, toggleDmScreenShare
 */
export const toggleScreenShareUnified = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleScreenShareUnified", async ({ getRoom }, { dispatch, getState }) => {
  const state = getState();
  const { isScreenSharing, currentChannelId, currentDmGroupId } = state.voice;
  const room = getRoom();

  if (!room || (!currentChannelId && !currentDmGroupId)) {
    console.warn('Cannot toggle screen share: no active room or channel/DM');
    return;
  }

  if (room.state !== 'connected') {
    console.error('Cannot toggle screen share: room is not connected, state:', room.state);
    throw new Error('Room is not connected');
  }

  const newState = !isScreenSharing;

  try {
    // Note: No longer sending screen share state to server - LiveKit manages it

    // Handle the actual LiveKit screen share
    if (newState) {
      // Get screen share settings (set by ScreenSourcePicker for Electron)
      const settings = getScreenShareSettings() || DEFAULT_SCREEN_SHARE_SETTINGS;

      // Get resolution and audio configs using shared utilities
      const resolutionConfig = getResolutionConfig(settings.resolution, settings.fps);
      const audioConfig = getScreenShareAudioConfig(settings.enableAudio !== false);

      await room.localParticipant.setScreenShareEnabled(true, {
        audio: audioConfig,
        resolution: resolutionConfig as { width: number; height: number; frameRate: number },
        preferCurrentTab: false,
      });
    } else {
      await room.localParticipant.setScreenShareEnabled(false);
    }

    // Update Redux state after successful LiveKit operation
    dispatch(setScreenSharing(newState));
  } catch (error) {
    console.error("Failed to toggle screen share:", error);
    // Don't revert server state, only local
    dispatch(setScreenSharing(isScreenSharing));
    throw error;
  }
});

/**
 * Unified deafen toggle for both channels and DMs
 * Replaces: toggleDeafen, toggleDmDeafen
 */
export const toggleDeafenUnified = createAsyncThunk<void, void, { state: RootState }>(
  "voice/toggleDeafenUnified",
  async (_, { dispatch, getState }) => {
    const state = getState();
    const { isDeafened, isMuted, contextType, currentChannelId, currentDmGroupId } = state.voice;

    if (!currentChannelId && !currentDmGroupId) return;

    const newDeafenedState = !isDeafened;

    try {
      dispatch(setDeafened(newDeafenedState));

      // When deafening, automatically mute as well (Discord-style)
      if (newDeafenedState && !isMuted) {
        dispatch(setMuted(true));
      }

      // Update server state
      if (contextType === 'dm' && currentDmGroupId) {
        await dispatch(
          voicePresenceApi.endpoints.updateDmVoiceState.initiate({
            dmGroupId: currentDmGroupId,
            updates: {
              isDeafened: newDeafenedState,
              ...(newDeafenedState && !isMuted && { isMuted: true }),
            },
          })
        ).unwrap();
      } else if (contextType === 'channel' && currentChannelId) {
        await dispatch(
          voicePresenceApi.endpoints.updateVoiceState.initiate({
            channelId: currentChannelId,
            updates: {
              isDeafened: newDeafenedState,
              ...(newDeafenedState && !isMuted && { isMuted: true }),
            },
          })
        ).unwrap();
      }
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
