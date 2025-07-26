import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent, ConnectionState, Track } from 'livekit-client';
import { useSocket } from '../hooks/useSocket';
import { ServerEvents } from '../types/server-events.enum';
import { ClientEvents } from '../types/client-events.enum';
import { 
  useGenerateTokenMutation, 
  useGetConnectionInfoQuery 
} from '../features/livekit/livekitApiSlice';
import { 
  useJoinVoiceChannelMutation,
  useLeaveVoiceChannelMutation,
  useUpdateVoiceStateMutation,
  VoicePresenceUser 
} from '../features/voice-presence/voicePresenceApiSlice';
import { useProfileQuery } from '../features/users/usersSlice';

export interface VoiceConnectionState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Channel info
  currentChannelId: string | null;
  channelName: string | null;
  communityId: string | null;
  isPrivate: boolean | null;
  createdAt: string | null;
  
  // Room and participants
  room: Room | null;
  participants: VoicePresenceUser[];
  
  // Local user state
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  
  // UI state
  showVideoTiles: boolean;
}

interface VoiceConnectionActions {
  joinVoiceChannel: (channelId: string, channelName: string, communityId: string, isPrivate: boolean, createdAt: string) => Promise<void>;
  leaveVoiceChannel: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setShowVideoTiles: (show: boolean) => void;
}

type VoiceConnectionAction = 
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_CONNECTED'; payload: { channelId: string; channelName: string; communityId: string; isPrivate: boolean; createdAt: string; room: Room } }
  | { type: 'SET_DISCONNECTED' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_PARTICIPANTS'; payload: VoicePresenceUser[] }
  | { type: 'UPDATE_PARTICIPANT'; payload: VoicePresenceUser }
  | { type: 'REMOVE_PARTICIPANT'; payload: string }
  | { type: 'TOGGLE_AUDIO' }
  | { type: 'TOGGLE_VIDEO' }
  | { type: 'TOGGLE_SCREEN_SHARE' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'TOGGLE_DEAFEN' }
  | { type: 'SET_SHOW_VIDEO_TILES'; payload: boolean };

const initialState: VoiceConnectionState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  currentChannelId: null,
  channelName: null,
  communityId: null,
  isPrivate: null,
  createdAt: null,
  room: null,
  participants: [],
  isAudioEnabled: true,
  isVideoEnabled: false,
  isScreenSharing: false,
  isMuted: false,
  isDeafened: false,
  showVideoTiles: false,
};

function voiceConnectionReducer(
  state: VoiceConnectionState, 
  action: VoiceConnectionAction
): VoiceConnectionState {
  switch (action.type) {
    case 'SET_CONNECTING':
      return { ...state, isConnecting: action.payload, connectionError: null };
    
    case 'SET_CONNECTED':
      return {
        ...state,
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        currentChannelId: action.payload.channelId,
        channelName: action.payload.channelName,
        communityId: action.payload.communityId,
        isPrivate: action.payload.isPrivate,
        createdAt: action.payload.createdAt,
        room: action.payload.room,
      };
    
    case 'SET_DISCONNECTED':
      return {
        ...initialState,
        participants: [], // Clear participants when disconnected
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        isConnecting: false,
        connectionError: action.payload,
      };
    
    case 'SET_PARTICIPANTS':
      return { ...state, participants: action.payload };
    
    case 'UPDATE_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.map(p => 
          p.id === action.payload.id ? action.payload : p
        ),
      };
    
    case 'REMOVE_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.filter(p => p.id !== action.payload),
      };
    
    case 'TOGGLE_AUDIO':
      return { ...state, isAudioEnabled: !state.isAudioEnabled };
    
    case 'TOGGLE_VIDEO':
      return { ...state, isVideoEnabled: !state.isVideoEnabled };
    
    case 'TOGGLE_SCREEN_SHARE':
      return { ...state, isScreenSharing: !state.isScreenSharing };
    
    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted };
    
    case 'TOGGLE_DEAFEN':
      return { ...state, isDeafened: !state.isDeafened };
    
    case 'SET_SHOW_VIDEO_TILES':
      return { ...state, showVideoTiles: action.payload };
    
    default:
      return state;
  }
}

const VoiceConnectionContext = createContext<{
  state: VoiceConnectionState;
  actions: VoiceConnectionActions;
} | null>(null);

export const useVoiceConnection = () => {
  const context = useContext(VoiceConnectionContext);
  if (!context) {
    throw new Error('useVoiceConnection must be used within a VoiceConnectionProvider');
  }
  return context;
};

interface VoiceConnectionProviderProps {
  children: React.ReactNode;
}

export const VoiceConnectionProvider: React.FC<VoiceConnectionProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(voiceConnectionReducer, initialState);
  const socket = useSocket();
  const roomRef = useRef<Room | null>(null);
  
  // API hooks
  const { data: user } = useProfileQuery();
  const { data: connectionInfo } = useGetConnectionInfoQuery();
  const [generateToken] = useGenerateTokenMutation();
  const [joinVoiceChannelAPI] = useJoinVoiceChannelMutation();
  const [leaveVoiceChannelAPI] = useLeaveVoiceChannelMutation();
  const [updateVoiceState] = useUpdateVoiceStateMutation();

  // WebSocket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = (data: { channelId: string; user: VoicePresenceUser }) => {
      if (data.channelId === state.currentChannelId) {
        dispatch({ type: 'UPDATE_PARTICIPANT', payload: data.user });
      }
    };

    const handleUserLeft = (data: { channelId: string; userId: string }) => {
      if (data.channelId === state.currentChannelId) {
        dispatch({ type: 'REMOVE_PARTICIPANT', payload: data.userId });
      }
    };

    const handleUserUpdated = (data: { channelId: string; user: VoicePresenceUser }) => {
      if (data.channelId === state.currentChannelId) {
        dispatch({ type: 'UPDATE_PARTICIPANT', payload: data.user });
      }
    };

    socket.on(ServerEvents.VOICE_CHANNEL_USER_JOINED, handleUserJoined);
    socket.on(ServerEvents.VOICE_CHANNEL_USER_LEFT, handleUserLeft);
    socket.on(ServerEvents.VOICE_CHANNEL_USER_UPDATED, handleUserUpdated);

    return () => {
      socket.off(ServerEvents.VOICE_CHANNEL_USER_JOINED, handleUserJoined);
      socket.off(ServerEvents.VOICE_CHANNEL_USER_LEFT, handleUserLeft);
      socket.off(ServerEvents.VOICE_CHANNEL_USER_UPDATED, handleUserUpdated);
    };
  }, [socket, state.currentChannelId]);

  // Room event handlers
  useEffect(() => {
    if (!state.room) return;

    const room = state.room;

    const handleConnectionStateChanged = (connectionState: ConnectionState) => {
      if (connectionState === ConnectionState.Disconnected) {
        dispatch({ type: 'SET_DISCONNECTED' });
      }
    };

    const handleTrackSubscribed = (track: Track) => {
      // Handle new track subscriptions
      console.log('Track subscribed:', track);
    };

    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [state.room]);

  const joinVoiceChannel = useCallback(async (channelId: string, channelName: string, communityId: string, isPrivate: boolean, createdAt: string) => {
    if (!user || !connectionInfo) {
      dispatch({ type: 'SET_ERROR', payload: 'User or connection info not available' });
      return;
    }

    try {
      dispatch({ type: 'SET_CONNECTING', payload: true });

      // Generate LiveKit token
      const tokenResponse = await generateToken({
        roomId: channelId,
        identity: user.id,
        name: user.displayName || user.username,
      }).unwrap();

      // Join voice channel on backend
      await joinVoiceChannelAPI(channelId).unwrap();

      // Create and connect to LiveKit room
      const room = new Room();
      roomRef.current = room;

      await room.connect(connectionInfo.url, tokenResponse.token);

      dispatch({ 
        type: 'SET_CONNECTED', 
        payload: { channelId, channelName, communityId, isPrivate, createdAt, room } 
      });

      // Notify via WebSocket
      socket?.emit(ClientEvents.VOICE_CHANNEL_JOIN, { channelId });

    } catch (error) {
      console.error('Failed to join voice channel:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to join voice channel' 
      });
    }
  }, [user, connectionInfo, generateToken, joinVoiceChannelAPI, socket]);

  const leaveVoiceChannel = useCallback(async () => {
    if (!state.currentChannelId || !state.room) return;

    try {
      const channelId = state.currentChannelId;

      // Disconnect from LiveKit room
      await state.room.disconnect();
      
      // Leave voice channel on backend
      await leaveVoiceChannelAPI(channelId).unwrap();

      // Notify via WebSocket
      socket?.emit(ClientEvents.VOICE_CHANNEL_LEAVE, { channelId });

      dispatch({ type: 'SET_DISCONNECTED' });
      roomRef.current = null;

    } catch (error) {
      console.error('Failed to leave voice channel:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to leave voice channel' 
      });
    }
  }, [state.currentChannelId, state.room, leaveVoiceChannelAPI, socket]);

  const toggleAudio = useCallback(async () => {
    if (!state.room) return;
    
    const newState = !state.isAudioEnabled;
    await state.room.localParticipant.setMicrophoneEnabled(newState);
    dispatch({ type: 'TOGGLE_AUDIO' });
    
    if (state.currentChannelId) {
      updateVoiceState({ 
        channelId: state.currentChannelId, 
        updates: { isMuted: !newState } 
      });
    }
  }, [state.room, state.isAudioEnabled, state.currentChannelId, updateVoiceState]);

  const toggleVideo = useCallback(async () => {
    if (!state.room) return;
    
    const newState = !state.isVideoEnabled;
    await state.room.localParticipant.setCameraEnabled(newState);
    dispatch({ type: 'TOGGLE_VIDEO' });
    
    if (state.currentChannelId) {
      updateVoiceState({ 
        channelId: state.currentChannelId, 
        updates: { isVideoEnabled: newState } 
      });
    }
  }, [state.room, state.isVideoEnabled, state.currentChannelId, updateVoiceState]);

  const toggleScreenShare = useCallback(async () => {
    if (!state.room) return;
    
    const newState = !state.isScreenSharing;
    if (newState) {
      await state.room.localParticipant.setScreenShareEnabled(true);
    } else {
      await state.room.localParticipant.setScreenShareEnabled(false);
    }
    dispatch({ type: 'TOGGLE_SCREEN_SHARE' });
    
    if (state.currentChannelId) {
      updateVoiceState({ 
        channelId: state.currentChannelId, 
        updates: { isScreenSharing: newState } 
      });
    }
  }, [state.room, state.isScreenSharing, state.currentChannelId, updateVoiceState]);

  const toggleMute = useCallback(() => {
    dispatch({ type: 'TOGGLE_MUTE' });
  }, []);

  const toggleDeafen = useCallback(() => {
    dispatch({ type: 'TOGGLE_DEAFEN' });
  }, []);

  const setShowVideoTiles = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_VIDEO_TILES', payload: show });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  const actions: VoiceConnectionActions = {
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleMute,
    toggleDeafen,
    setShowVideoTiles,
  };

  return (
    <VoiceConnectionContext.Provider value={{ state, actions }}>
      {children}
    </VoiceConnectionContext.Provider>
  );
};