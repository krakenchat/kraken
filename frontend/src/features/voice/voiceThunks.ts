import { createAsyncThunk } from "@reduxjs/toolkit";
import { Room, VideoCaptureOptions } from "livekit-client";
import { RootState } from "../../app/store";
import {
  setConnecting,
  setConnected,
  setDmConnected,
  setDisconnected,
  setConnectionError,
  setDeafened,
  setSelectedAudioInputId,
  setSelectedAudioOutputId,
  setSelectedVideoInputId,
} from "./voiceSlice";
import { voicePresenceApi } from "../voice-presence/voicePresenceApiSlice";
import { livekitApi } from "../livekit/livekitApiSlice";
import { getScreenShareSettings, DEFAULT_SCREEN_SHARE_SETTINGS } from "../../utils/screenShareState";
import { getResolutionConfig, getScreenShareAudioConfig } from "../../utils/screenShareResolution";
import { logger } from "../../utils/logger";
import { getCachedItem } from "../../utils/storage";

// Storage key must match useDeviceSettings.ts
const DEVICE_PREFERENCES_KEY = 'kraken_device_preferences';

interface DevicePreferences {
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
  videoInputDeviceId: string;
}

interface JoinVoiceChannelParams {
  channelId: string;
  channelName: string;
  communityId: string;
  isPrivate: boolean;
  createdAt: string;
  user: { id: string; username: string; displayName?: string };
  connectionInfo: { url: string };
  setRoom: (room: Room | null) => void;
}

/**
 * Shared helper to connect to LiveKit room and enable microphone
 * Used by both channel and DM voice joining
 */
async function connectToLiveKitRoom(
  url: string,
  token: string,
  setRoom: (room: Room | null) => void
): Promise<Room> {
  logger.info('[Voice] Creating new LiveKit room instance');
  const room = new Room();

  try {
    logger.info('[Voice] Connecting to LiveKit server:', url);
    await room.connect(url, token);
    logger.info('[Voice] ✓ Connected to LiveKit room, state:', room.state);
    setRoom(room);

    // Set initial participant metadata
    // This is picked up by LiveKit webhooks when participant_joined is fired
    const initialMetadata = JSON.stringify({ isDeafened: false });
    await room.localParticipant.setMetadata(initialMetadata);
    logger.info('[Voice] ✓ Set initial participant metadata');
  } catch (error) {
    logger.error('[Voice] ✗ Failed to connect to LiveKit room:', error);
    throw error;
  }

  // Enable microphone by default when joining
  // Audio state is read directly from LiveKit via useLocalMediaState() - no Redux dispatch needed
  // Use a timeout to prevent hanging if mic permissions are pending (common on Edge)
  logger.info('[Voice] Attempting to enable microphone...');
  try {
    const micPromise = room.localParticipant.setMicrophoneEnabled(true);
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Microphone enable timeout (5s)')), 5000)
    );
    await Promise.race([micPromise, timeoutPromise]);
    logger.info('[Voice] ✓ Microphone enabled successfully');
  } catch (error) {
    logger.warn('[Voice] ⚠ Failed to enable microphone (user will join muted):', error);
    // Don't fail the whole join if mic fails, just log it
    // User will appear muted but can manually unmute later
  }

  // Apply saved device preferences from localStorage
  // This ensures audio settings persist across page refreshes
  const savedPreferences = getCachedItem<DevicePreferences>(DEVICE_PREFERENCES_KEY);
  if (savedPreferences) {
    logger.info('[Voice] Applying saved device preferences:', savedPreferences);

    try {
      // Apply saved audio input device if not 'default'
      if (savedPreferences.audioInputDeviceId && savedPreferences.audioInputDeviceId !== 'default') {
        await room.switchActiveDevice('audioinput', savedPreferences.audioInputDeviceId);
        logger.info('[Voice] ✓ Applied saved audio input device:', savedPreferences.audioInputDeviceId);
      }

      // Apply saved audio output device if not 'default'
      if (savedPreferences.audioOutputDeviceId && savedPreferences.audioOutputDeviceId !== 'default') {
        await room.switchActiveDevice('audiooutput', savedPreferences.audioOutputDeviceId);
        logger.info('[Voice] ✓ Applied saved audio output device:', savedPreferences.audioOutputDeviceId);
      }

      // Note: Video input is applied when camera is enabled, not at connection time
    } catch (error) {
      // Don't fail the connection if device switching fails
      // The saved device might no longer be available
      logger.warn('[Voice] ⚠ Failed to apply saved device preferences:', error);
    }
  }

  logger.info('[Voice] ✓ Room connection complete');
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
      setRoom,
    },
    { dispatch }
  ) => {
    logger.info('[Voice] === Starting voice channel join ===');
    logger.info('[Voice] Channel:', channelId, channelName);
    logger.info('[Voice] User:', user.id, user.displayName || user.username);

    try {
      dispatch(setConnecting(true));
      logger.info('[Voice] Set connecting state');

      // Generate LiveKit token
      logger.info('[Voice] Requesting LiveKit token...');
      const tokenResponse = await dispatch(
        livekitApi.endpoints.generateToken.initiate({
          roomId: channelId,
          identity: user.id,
          name: user.displayName || user.username,
        })
      ).unwrap();
      logger.info('[Voice] ✓ Got LiveKit token');

      // Note: Voice presence is now managed by LiveKit webhooks
      // When we connect to LiveKit, the participant_joined webhook will update Redis
      // No need for explicit joinVoiceChannel REST call

      // Connect to LiveKit room and enable microphone
      logger.info('[Voice] Connecting to LiveKit room...');
      await connectToLiveKitRoom(connectionInfo.url, tokenResponse.token, setRoom);

      logger.info('[Voice] Dispatching setConnected...');
      dispatch(
        setConnected({
          channelId,
          channelName,
          communityId,
          isPrivate,
          createdAt,
        })
      );
      logger.info('[Voice] ✓ setConnected dispatched');

      // Invalidate presence cache to ensure we fetch fresh data after joining
      // This fixes the issue where presence list is empty after page refresh + rejoin
      logger.info('[Voice] Invalidating presence cache...');
      dispatch(
        voicePresenceApi.util.invalidateTags([{ type: "VoicePresence", id: channelId }])
      );

      // Note: Voice presence is now managed by LiveKit webhooks
      // The participant_joined webhook will update Redis when we connect

      logger.info('[Voice] === Voice channel join complete ===');
    } catch (error) {
      logger.error("[Voice] ✗ Failed to join voice channel:", error);
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
    getRoom: () => Room | null;
    setRoom: (room: Room | null) => void;
  },
  { state: RootState }
>(
  "voice/leaveChannel",
  async ({ getRoom, setRoom }, { dispatch, getState }) => {
    const state = getState();
    const { currentChannelId } = state.voice;
    const room = getRoom();

    if (!currentChannelId || !room) {
      logger.warn('[Voice] leaveVoiceChannel: No channel or room', { currentChannelId, room: !!room });
      return;
    }

    logger.info('[Voice] === Leaving voice channel ===');
    logger.info('[Voice] Channel:', currentChannelId);

    try {
      const channelId = currentChannelId;

      // Disconnect from LiveKit room
      // Note: Voice presence is now managed by LiveKit webhooks
      // When we disconnect, the participant_left webhook will update Redis
      logger.info('[Voice] Disconnecting from LiveKit room...');
      await room.disconnect();
      logger.info('[Voice] ✓ Disconnected from LiveKit');

      // Clear room reference
      setRoom(null);

      dispatch(setDisconnected());
      logger.info('[Voice] === Voice channel leave complete ===');
    } catch (error) {
      logger.error('[Voice] ✗ Failed to leave voice channel:', error);
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
      logger.error("Failed to switch audio input device:", error);
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
      logger.error("Failed to switch audio output device:", error);
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
      logger.error("Failed to switch video input device:", error);
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

      // Note: DM voice presence is now managed by LiveKit webhooks
      // When we connect to LiveKit, the participant_joined webhook will update Redis

      // Connect to LiveKit room and enable microphone
      await connectToLiveKitRoom(connectionInfo.url, tokenResponse.token, setRoom);

      dispatch(
        setDmConnected({
          dmGroupId,
          dmGroupName,
        })
      );

      // Invalidate presence cache to ensure we fetch fresh data after joining
      dispatch(
        voicePresenceApi.util.invalidateTags([{ type: "VoicePresence", id: `dm-${dmGroupId}` }])
      );

      // WebSocket notification handled by backend (DM_VOICE_CALL_STARTED or DM_VOICE_USER_JOINED)
    } catch (error) {
      logger.error("Failed to join DM voice call:", error);
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
      // Disconnect from LiveKit room
      // Note: DM voice presence is now managed by LiveKit webhooks
      // When we disconnect, the participant_left webhook will update Redis
      await room.disconnect();

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
 * Audio state is read directly from LiveKit - no Redux dispatch needed
 */
export const toggleMicrophone = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleMicrophone", async ({ getRoom }, { getState }) => {
  const state = getState();
  const { currentChannelId, currentDmGroupId } = state.voice;
  const room = getRoom();

  if (!room || (!currentChannelId && !currentDmGroupId)) {
    logger.warn('[Voice] toggleMicrophone: No room or channel/DM', { room: !!room, currentChannelId, currentDmGroupId });
    return;
  }

  // Read current mic state directly from LiveKit
  const isCurrentlyEnabled = room.localParticipant.isMicrophoneEnabled;
  const newState = !isCurrentlyEnabled;
  logger.info('[Voice] Toggling microphone:', isCurrentlyEnabled, '->', newState);

  try {
    // Toggle LiveKit microphone - state is read via useLocalMediaState() hook
    await room.localParticipant.setMicrophoneEnabled(newState);
    logger.info('[Voice] ✓ Microphone toggled successfully');
    // Note: No Redux dispatch needed - components read from LiveKit via useLocalMediaState()
  } catch (error) {
    logger.error("[Voice] ✗ Failed to toggle microphone:", error);
    throw error;
  }
});

/**
 * Unified camera toggle for both channels and DMs
 * Replaces: toggleVideo, toggleDmVideo
 * Video state is read directly from LiveKit - no Redux dispatch needed
 */
export const toggleCameraUnified = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleCameraUnified", async ({ getRoom }, { getState }) => {
  const state = getState();
  const { currentChannelId, currentDmGroupId, selectedVideoInputId } = state.voice;
  const room = getRoom();

  if (!room || (!currentChannelId && !currentDmGroupId)) {
    logger.warn('[Voice] toggleCamera: No room or channel/DM', { room: !!room, currentChannelId, currentDmGroupId });
    return;
  }

  if (room.state !== 'connected') {
    logger.error('[Voice] toggleCamera: Room not connected, state:', room.state);
    throw new Error('Room is not connected');
  }

  // Read current camera state directly from LiveKit
  const isCurrentlyEnabled = room.localParticipant.isCameraEnabled;
  const newState = !isCurrentlyEnabled;
  logger.info('[Voice] Toggling camera:', isCurrentlyEnabled, '->', newState);

  try {
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

    // Toggle LiveKit camera - state is read via useLocalMediaState() hook
    await room.localParticipant.setCameraEnabled(newState, videoCaptureOptions);
    logger.info('[Voice] ✓ Camera toggled successfully');
    // Note: No Redux dispatch needed - components read from LiveKit via useLocalMediaState()
  } catch (error) {
    logger.error("[Voice] ✗ Failed to toggle camera:", error);
    throw error;
  }
});

/**
 * Unified screen share toggle for both channels and DMs
 * Replaces: toggleScreenShare, toggleDmScreenShare
 * Screen share state is read directly from LiveKit - no Redux dispatch needed
 */
export const toggleScreenShareUnified = createAsyncThunk<
  void,
  { getRoom: () => Room | null },
  { state: RootState }
>("voice/toggleScreenShareUnified", async ({ getRoom }, { getState }) => {
  const state = getState();
  const { currentChannelId, currentDmGroupId } = state.voice;
  const room = getRoom();

  if (!room || (!currentChannelId && !currentDmGroupId)) {
    logger.warn('[Voice] toggleScreenShare: No room or channel/DM', { room: !!room, currentChannelId, currentDmGroupId });
    return;
  }

  if (room.state !== 'connected') {
    logger.error('[Voice] toggleScreenShare: Room not connected, state:', room.state);
    throw new Error('Room is not connected');
  }

  // Read current screen share state directly from LiveKit
  const isCurrentlySharing = room.localParticipant.isScreenShareEnabled;
  const newState = !isCurrentlySharing;
  logger.info('[Voice] Toggling screen share:', isCurrentlySharing, '->', newState);

  try {
    // Handle the actual LiveKit screen share
    if (newState) {
      // Get screen share settings (set by ScreenSourcePicker for Electron)
      const settings = getScreenShareSettings() || DEFAULT_SCREEN_SHARE_SETTINGS;
      logger.info('[Voice] Screen share settings:', settings);

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
    logger.info('[Voice] ✓ Screen share toggled successfully');
    // Note: No Redux dispatch needed - components read from LiveKit via useLocalMediaState()
  } catch (error) {
    logger.error("[Voice] ✗ Failed to toggle screen share:", error);
    throw error;
  }
});

/**
 * Unified deafen toggle for both channels and DMs
 * Replaces: toggleDeafen, toggleDmDeafen
 *
 * Deafen is a custom UI state - stored in both:
 * 1. Redux (for local UI state)
 * 2. LiveKit participant metadata (so other connected users can see)
 * 3. Redis via REST (for non-connected users to query) - to be removed in Phase 3
 *
 * When deafening, we also disable the microphone (Discord-style behavior)
 */
export const toggleDeafenUnified = createAsyncThunk<
  void,
  { getRoom?: () => Room | null },
  { state: RootState }
>(
  "voice/toggleDeafenUnified",
  async ({ getRoom }, { dispatch, getState }) => {
    const state = getState();
    const { isDeafened, contextType, currentChannelId, currentDmGroupId } = state.voice;

    if (!currentChannelId && !currentDmGroupId) return;

    const newDeafenedState = !isDeafened;
    const room = getRoom?.();

    try {
      dispatch(setDeafened(newDeafenedState));

      // Update LiveKit participant metadata so other connected users can see our deafen state
      if (room) {
        const currentMetadata = room.localParticipant.metadata;
        let metadata: Record<string, unknown> = {};
        try {
          metadata = currentMetadata ? JSON.parse(currentMetadata) : {};
        } catch {
          // Invalid existing metadata, start fresh
        }
        metadata.isDeafened = newDeafenedState;
        await room.localParticipant.setMetadata(JSON.stringify(metadata));
        logger.info('[Voice] Updated LiveKit metadata with isDeafened:', newDeafenedState);
      }

      // When deafening, automatically mute mic as well (Discord-style)
      // Read mic state from LiveKit, not Redux
      if (newDeafenedState && room) {
        const isMicEnabled = room.localParticipant.isMicrophoneEnabled;
        if (isMicEnabled) {
          await room.localParticipant.setMicrophoneEnabled(false);
        }
      }

      // Update server state (for non-connected users to query)
      // Note: This will be removed in Phase 3 once webhooks fully replace REST
      if (contextType === 'dm' && currentDmGroupId) {
        await dispatch(
          voicePresenceApi.endpoints.updateDmVoiceState.initiate({
            dmGroupId: currentDmGroupId,
            updates: { isDeafened: newDeafenedState },
          })
        ).unwrap();
      } else if (contextType === 'channel' && currentChannelId) {
        await dispatch(
          voicePresenceApi.endpoints.updateVoiceState.initiate({
            channelId: currentChannelId,
            updates: { isDeafened: newDeafenedState },
          })
        ).unwrap();
      }
    } catch (error) {
      logger.error("Failed to toggle deafen:", error);
      // Revert local state on failure
      dispatch(setDeafened(isDeafened));
      throw error;
    }
  }
);
