import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type VoiceContextType = 'channel' | 'dm' | null;

export interface VoiceState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Context type ('channel' or 'dm')
  contextType: VoiceContextType;

  // Current channel info (for channel voice)
  currentChannelId: string | null;
  channelName: string | null;
  communityId: string | null;
  isPrivate: boolean | null;
  createdAt: string | null;

  // Current DM info (for DM voice)
  currentDmGroupId: string | null;
  dmGroupName: string | null;

  // LiveKit room managed separately (not stored in Redux due to non-serializable nature)
  // Media state (audio, video, screen share, speaking) is read from LiveKit via useLocalMediaState()

  // Custom UI state (server-synced)
  isDeafened: boolean;

  // UI state
  showVideoTiles: boolean;

  // Screen share audio warning (when audio capture fails but video continues)
  screenShareAudioFailed: boolean;

  // Device preferences
  selectedAudioInputId: string | null;
  selectedAudioOutputId: string | null;
  selectedVideoInputId: string | null;
}

const initialState: VoiceState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  contextType: null,
  currentChannelId: null,
  channelName: null,
  communityId: null,
  isPrivate: null,
  createdAt: null,
  currentDmGroupId: null,
  dmGroupName: null,
  isDeafened: false,
  showVideoTiles: false,
  screenShareAudioFailed: false,
  selectedAudioInputId: null,
  selectedAudioOutputId: null,
  selectedVideoInputId: null,
};

const voiceSlice = createSlice({
  name: 'voice',
  initialState,
  reducers: {
    setConnecting: (state, action: PayloadAction<boolean>) => {
      state.isConnecting = action.payload;
      if (action.payload) {
        state.connectionError = null;
      }
    },
    
    setConnected: (state, action: PayloadAction<{
      channelId: string;
      channelName: string;
      communityId: string;
      isPrivate: boolean;
      createdAt: string;
    }>) => {
      state.isConnected = true;
      state.isConnecting = false;
      state.connectionError = null;
      state.contextType = 'channel';
      state.currentChannelId = action.payload.channelId;
      state.channelName = action.payload.channelName;
      state.communityId = action.payload.communityId;
      state.isPrivate = action.payload.isPrivate;
      state.createdAt = action.payload.createdAt;
      // Clear DM fields
      state.currentDmGroupId = null;
      state.dmGroupName = null;
    },

    setDmConnected: (state, action: PayloadAction<{
      dmGroupId: string;
      dmGroupName: string;
    }>) => {
      state.isConnected = true;
      state.isConnecting = false;
      state.connectionError = null;
      state.contextType = 'dm';
      state.currentDmGroupId = action.payload.dmGroupId;
      state.dmGroupName = action.payload.dmGroupName;
      // Clear channel fields
      state.currentChannelId = null;
      state.channelName = null;
      state.communityId = null;
      state.isPrivate = null;
      state.createdAt = null;
    },
    
    setDisconnected: (state) => {
      return {
        ...initialState,
        // Preserve some UI state that should persist
        showVideoTiles: state.showVideoTiles,
      };
    },
    
    setConnectionError: (state, action: PayloadAction<string>) => {
      state.isConnecting = false;
      state.connectionError = action.payload;
    },

    // Custom UI state (server-synced)
    setDeafened: (state, action: PayloadAction<boolean>) => {
      state.isDeafened = action.payload;
    },

    // UI actions
    setShowVideoTiles: (state, action: PayloadAction<boolean>) => {
      state.showVideoTiles = action.payload;
    },

    setScreenShareAudioFailed: (state, action: PayloadAction<boolean>) => {
      state.screenShareAudioFailed = action.payload;
    },
    
    // Device preference actions
    setSelectedAudioInputId: (state, action: PayloadAction<string | null>) => {
      state.selectedAudioInputId = action.payload;
    },
    
    setSelectedAudioOutputId: (state, action: PayloadAction<string | null>) => {
      state.selectedAudioOutputId = action.payload;
    },
    
    setSelectedVideoInputId: (state, action: PayloadAction<string | null>) => {
      state.selectedVideoInputId = action.payload;
    },
  },
});

export const {
  setConnecting,
  setConnected,
  setDmConnected,
  setDisconnected,
  setConnectionError,
  setDeafened,
  setShowVideoTiles,
  setScreenShareAudioFailed,
  setSelectedAudioInputId,
  setSelectedAudioOutputId,
  setSelectedVideoInputId,
} = voiceSlice.actions;

export default voiceSlice.reducer;