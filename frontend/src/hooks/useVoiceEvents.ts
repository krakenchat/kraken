import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../app/store';
import { useSocket } from './useSocket';
import { ServerEvents } from '@kraken/shared';
import { VoicePresenceUser, voicePresenceApi } from '../features/voice-presence/voicePresenceApiSlice';
import { logger } from '../utils/logger';

export const useVoiceEvents = () => {
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) {
      logger.dev('useVoiceEvents: No socket available');
      return;
    }

    logger.dev('useVoiceEvents: Setting up global voice presence listeners');

    const handleUserJoined = (data: { channelId: string; user: VoicePresenceUser }) => {
      logger.dev('🎤 Voice user joined:', {
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
      } catch {
        logger.dev('No cache found for channel, invalidating tag:', data.channelId);
        // If cache doesn't exist, invalidate the tag to trigger refetch when component loads
        dispatch(
          voicePresenceApi.util.invalidateTags([{ type: 'VoicePresence', id: data.channelId }])
        );
      }

      // Note: We intentionally don't update Redux voice state here since it's channel-specific
      // RTK Query cache updates above handle the global presence updates that all users need
    };

    const handleUserLeft = (data: { channelId: string; userId: string }) => {
      logger.dev('Voice user left:', data);
      
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
      } catch {
        logger.dev('No cache found for channel, invalidating tag:', data.channelId);
        // If cache doesn't exist, invalidate the tag to trigger refetch when component loads
        dispatch(
          voicePresenceApi.util.invalidateTags([{ type: 'VoicePresence', id: data.channelId }])
        );
      }

      // Note: We intentionally don't update Redux voice state here since it's channel-specific
      // RTK Query cache updates above handle the global presence updates that all users need
    };

    const handleUserUpdated = (data: { channelId: string; user: VoicePresenceUser }) => {
      logger.dev('Voice user updated:', data);
      
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
      } catch {
        logger.dev('No cache found for channel, invalidating tag:', data.channelId);
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