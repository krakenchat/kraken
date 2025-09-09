import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import { useSocket } from './useSocket';
import { ServerEvents } from '../types/server-events.enum';
import { updateParticipant, removeParticipant } from '../features/voice/voiceSlice';
import { VoicePresenceUser, voicePresenceApi } from '../features/voice-presence/voicePresenceApiSlice';

export const useVoiceEvents = () => {
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocket();
  const currentChannelId = useSelector((state: RootState) => state.voice.currentChannelId);

  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = (data: { channelId: string; user: VoicePresenceUser }) => {
      console.log('Voice user joined:', data);
      
      // Update RTK Query cache for all channels (global updates)
      dispatch(
        voicePresenceApi.util.updateQueryData('getChannelPresence', data.channelId, (draft) => {
          const existingIndex = draft.users.findIndex(u => u.id === data.user.id);
          if (existingIndex === -1) {
            draft.users.push(data.user);
            draft.count = draft.users.length;
          }
        })
      );

      // Only update Redux voice state for current channel
      if (data.channelId === currentChannelId) {
        dispatch(updateParticipant(data.user));
      }
    };

    const handleUserLeft = (data: { channelId: string; userId: string }) => {
      console.log('Voice user left:', data);
      
      // Update RTK Query cache for all channels (global updates)
      dispatch(
        voicePresenceApi.util.updateQueryData('getChannelPresence', data.channelId, (draft) => {
          const index = draft.users.findIndex(u => u.id === data.userId);
          if (index !== -1) {
            draft.users.splice(index, 1);
            draft.count = draft.users.length;
          }
        })
      );

      // Only update Redux voice state for current channel
      if (data.channelId === currentChannelId) {
        dispatch(removeParticipant(data.userId));
      }
    };

    const handleUserUpdated = (data: { channelId: string; user: VoicePresenceUser }) => {
      console.log('Voice user updated:', data);
      
      // Update RTK Query cache for all channels (global updates)
      dispatch(
        voicePresenceApi.util.updateQueryData('getChannelPresence', data.channelId, (draft) => {
          const index = draft.users.findIndex(u => u.id === data.user.id);
          if (index !== -1) {
            // IMPORTANT: Replace the entire user object to preserve all fields
            draft.users[index] = data.user;
          }
        })
      );

      // Only update Redux voice state for current channel
      if (data.channelId === currentChannelId) {
        dispatch(updateParticipant(data.user));
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
  }, [socket, currentChannelId, dispatch]);
};