import React, { createContext, useContext, useReducer, useRef, useEffect } from "react";

export type VoiceContextType = 'channel' | 'dm' | null;

export interface VoiceState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  contextType: VoiceContextType;
  currentChannelId: string | null;
  channelName: string | null;
  communityId: string | null;
  isPrivate: boolean | null;
  createdAt: string | null;
  currentDmGroupId: string | null;
  dmGroupName: string | null;
  isDeafened: boolean;
  showVideoTiles: boolean;
  screenShareAudioFailed: boolean;
  selectedAudioInputId: string | null;
  selectedAudioOutputId: string | null;
  selectedVideoInputId: string | null;
}

export type VoiceAction =
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_CONNECTED'; payload: { channelId: string; channelName: string; communityId: string; isPrivate: boolean; createdAt: string } }
  | { type: 'SET_DM_CONNECTED'; payload: { dmGroupId: string; dmGroupName: string } }
  | { type: 'SET_DISCONNECTED' }
  | { type: 'SET_CONNECTION_ERROR'; payload: string }
  | { type: 'SET_DEAFENED'; payload: boolean }
  | { type: 'SET_SHOW_VIDEO_TILES'; payload: boolean }
  | { type: 'SET_SCREEN_SHARE_AUDIO_FAILED'; payload: boolean }
  | { type: 'SET_SELECTED_AUDIO_INPUT_ID'; payload: string | null }
  | { type: 'SET_SELECTED_AUDIO_OUTPUT_ID'; payload: string | null }
  | { type: 'SET_SELECTED_VIDEO_INPUT_ID'; payload: string | null };

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

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case 'SET_CONNECTING':
      return {
        ...state,
        isConnecting: action.payload,
        ...(action.payload ? { connectionError: null } : {}),
      };
    case 'SET_CONNECTED':
      return {
        ...state,
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        contextType: 'channel',
        currentChannelId: action.payload.channelId,
        channelName: action.payload.channelName,
        communityId: action.payload.communityId,
        isPrivate: action.payload.isPrivate,
        createdAt: action.payload.createdAt,
        currentDmGroupId: null,
        dmGroupName: null,
      };
    case 'SET_DM_CONNECTED':
      return {
        ...state,
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        contextType: 'dm',
        currentDmGroupId: action.payload.dmGroupId,
        dmGroupName: action.payload.dmGroupName,
        currentChannelId: null,
        channelName: null,
        communityId: null,
        isPrivate: null,
        createdAt: null,
      };
    case 'SET_DISCONNECTED':
      return {
        ...initialState,
        showVideoTiles: state.showVideoTiles,
      };
    case 'SET_CONNECTION_ERROR':
      return { ...state, isConnecting: false, connectionError: action.payload };
    case 'SET_DEAFENED':
      return { ...state, isDeafened: action.payload };
    case 'SET_SHOW_VIDEO_TILES':
      return { ...state, showVideoTiles: action.payload };
    case 'SET_SCREEN_SHARE_AUDIO_FAILED':
      return { ...state, screenShareAudioFailed: action.payload };
    case 'SET_SELECTED_AUDIO_INPUT_ID':
      return { ...state, selectedAudioInputId: action.payload };
    case 'SET_SELECTED_AUDIO_OUTPUT_ID':
      return { ...state, selectedAudioOutputId: action.payload };
    case 'SET_SELECTED_VIDEO_INPUT_ID':
      return { ...state, selectedVideoInputId: action.payload };
    default:
      return state;
  }
}

// Split into two contexts to avoid unnecessary re-renders
const VoiceStateContext = createContext<VoiceState | null>(null);
const VoiceDispatchContext = createContext<{
  dispatch: React.Dispatch<VoiceAction>;
  stateRef: React.RefObject<VoiceState>;
} | null>(null);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(voiceReducer, initialState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  return (
    <VoiceDispatchContext.Provider value={{ dispatch, stateRef }}>
      <VoiceStateContext.Provider value={state}>
        {children}
      </VoiceStateContext.Provider>
    </VoiceDispatchContext.Provider>
  );
};

/** Read voice state (re-renders on changes) */
export function useVoice(): VoiceState {
  const ctx = useContext(VoiceStateContext);
  if (!ctx) throw new Error('useVoice must be used within a VoiceProvider');
  return ctx;
}

/** Get voice dispatch + stateRef (stable, no re-renders from state changes) */
export function useVoiceDispatch() {
  const ctx = useContext(VoiceDispatchContext);
  if (!ctx) throw new Error('useVoiceDispatch must be used within a VoiceProvider');
  return ctx;
}
