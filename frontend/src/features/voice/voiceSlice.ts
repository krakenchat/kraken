import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VoicePresenceUser } from '../voice-presence/voicePresenceApiSlice';

export interface VoiceState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Current channel info
  currentChannelId: string | null;
  channelName: string | null;
  communityId: string | null;
  isPrivate: boolean | null;
  createdAt: string | null;
  
  // LiveKit room managed separately (not stored in Redux due to non-serializable nature)
  
  // Participants (from voice presence)
  participants: VoicePresenceUser[];
  
  // Local user voice states
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  
  // UI state
  showVideoTiles: boolean;
}

const initialState: VoiceState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  currentChannelId: null,
  channelName: null,
  communityId: null,
  isPrivate: null,
  createdAt: null,
  participants: [],
  isAudioEnabled: true,
  isVideoEnabled: false,
  isScreenSharing: false,
  isMuted: false,
  isDeafened: false,
  showVideoTiles: false,
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
      state.currentChannelId = action.payload.channelId;
      state.channelName = action.payload.channelName;
      state.communityId = action.payload.communityId;
      state.isPrivate = action.payload.isPrivate;
      state.createdAt = action.payload.createdAt;
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
    
    // Local voice state actions
    setAudioEnabled: (state, action: PayloadAction<boolean>) => {
      state.isAudioEnabled = action.payload;
    },
    
    setVideoEnabled: (state, action: PayloadAction<boolean>) => {
      state.isVideoEnabled = action.payload;
    },
    
    setScreenSharing: (state, action: PayloadAction<boolean>) => {
      state.isScreenSharing = action.payload;
    },
    
    setMuted: (state, action: PayloadAction<boolean>) => {
      state.isMuted = action.payload;
    },
    
    setDeafened: (state, action: PayloadAction<boolean>) => {
      state.isDeafened = action.payload;
    },
    
    // Participant management actions
    setParticipants: (state, action: PayloadAction<VoicePresenceUser[]>) => {
      state.participants = action.payload;
    },
    
    updateParticipant: (state, action: PayloadAction<VoicePresenceUser>) => {
      const index = state.participants.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.participants[index] = action.payload;
      } else {
        state.participants.push(action.payload);
      }
    },
    
    removeParticipant: (state, action: PayloadAction<string>) => {
      state.participants = state.participants.filter(p => p.id !== action.payload);
    },
    
    // UI actions
    setShowVideoTiles: (state, action: PayloadAction<boolean>) => {
      state.showVideoTiles = action.payload;
    },
  },
});

export const {
  setConnecting,
  setConnected,
  setDisconnected,
  setConnectionError,
  setAudioEnabled,
  setVideoEnabled,
  setScreenSharing,
  setMuted,
  setDeafened,
  setParticipants,
  updateParticipant,
  removeParticipant,
  setShowVideoTiles,
} = voiceSlice.actions;

export default voiceSlice.reducer;