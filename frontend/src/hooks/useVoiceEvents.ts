import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../app/store';
import { useSocket } from './useSocket';
import { ServerEvents } from '../types/server-events.enum';
import { VoicePresenceUser, voicePresenceApi } from '../features/voice-presence/voicePresenceApiSlice';

export const useVoiceEvents = () => {
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) {
      console.log('useVoiceEvents: No socket available');
      return;
    }

    console.log('useVoiceEvents: Setting up global voice presence listeners');

    const handleUserJoined = (data: { channelId: string; user: VoicePresenceUser }) => {
      console.log('🎤 Voice user joined:', { 
        channelId: data.channelId, 
        userId: data.user.id, 
        username: data.user.username 
      });
      
      // Try to update RTK Query cache - if it doesn't exist, invalidate the tag to refetch
      try {
        dispatch(
          voicePresenceApi.util.updateQueryData('getChannelPresence', data.channelId, (draft) => {
            const existingIndex = draft.users.findIndex(u => u.id === data.user.id);
            if (existingIndex === -1) {
              draft.users.push(data.user);
              draft.count = draft.users.length;
            }
          })
        );
      } catch (error) {
        console.log('No cache found for channel, invalidating tag:', data.channelId);
        // If cache doesn't exist, invalidate the tag to trigger refetch when component loads
        dispatch(
          voicePresenceApi.util.invalidateTags([{ type: 'VoicePresence', id: data.channelId }])
        );
      }

      // Note: We intentionally don't update Redux voice state here since it's channel-specific
      // RTK Query cache updates above handle the global presence updates that all users need
    };

    const handleUserLeft = (data: { channelId: string; userId: string }) => {
      console.log('Voice user left:', data);
      
      // Try to update RTK Query cache - if it doesn't exist, invalidate the tag to refetch
      try {
        dispatch(
          voicePresenceApi.util.updateQueryData('getChannelPresence', data.channelId, (draft) => {
            const index = draft.users.findIndex(u => u.id === data.userId);
            if (index !== -1) {
              draft.users.splice(index, 1);
              draft.count = draft.users.length;
            }
          })
        );
      } catch (error) {
        console.log('No cache found for channel, invalidating tag:', data.channelId);
        // If cache doesn't exist, invalidate the tag to trigger refetch when component loads
        dispatch(
          voicePresenceApi.util.invalidateTags([{ type: 'VoicePresence', id: data.channelId }])
        );
      }

      // Note: We intentionally don't update Redux voice state here since it's channel-specific
      // RTK Query cache updates above handle the global presence updates that all users need
    };

    const handleUserUpdated = (data: { channelId: string; user: VoicePresenceUser }) => {
      console.log('Voice user updated:', data);
      
      // Try to update RTK Query cache - if it doesn't exist, invalidate the tag to refetch
      try {
        dispatch(
          voicePresenceApi.util.updateQueryData('getChannelPresence', data.channelId, (draft) => {
            const index = draft.users.findIndex(u => u.id === data.user.id);
            if (index !== -1) {
              // IMPORTANT: Replace the entire user object to preserve all fields
              draft.users[index] = data.user;
            }
          })
        );
      } catch (error) {
        console.log('No cache found for channel, invalidating tag:', data.channelId);
        // If cache doesn't exist, invalidate the tag to trigger refetch when component loads
        dispatch(
          voicePresenceApi.util.invalidateTags([{ type: 'VoicePresence', id: data.channelId }])
        );
      }

      // Note: We intentionally don't update Redux voice state here since it's channel-specific
      // RTK Query cache updates above handle the global presence updates that all users need
    };

    socket.on(ServerEvents.VOICE_CHANNEL_USER_JOINED, handleUserJoined);
    socket.on(ServerEvents.VOICE_CHANNEL_USER_LEFT, handleUserLeft);
    socket.on(ServerEvents.VOICE_CHANNEL_USER_UPDATED, handleUserUpdated);

    return () => {
      socket.off(ServerEvents.VOICE_CHANNEL_USER_JOINED, handleUserJoined);
      socket.off(ServerEvents.VOICE_CHANNEL_USER_LEFT, handleUserLeft);
      socket.off(ServerEvents.VOICE_CHANNEL_USER_UPDATED, handleUserUpdated);
    };
  }, [socket, dispatch]); // Removed currentChannelId to prevent listener recreation
};