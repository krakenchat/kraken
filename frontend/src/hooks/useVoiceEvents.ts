import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { ServerEvents } from '@kraken/shared';
import { voicePresenceControllerGetChannelPresenceQueryKey } from '../api-client/@tanstack/react-query.gen';
import type { VoicePresenceUserDto, ChannelVoicePresenceResponseDto } from '../api-client/types.gen';

import { logger } from '../utils/logger';

export const useVoiceEvents = () => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) {
      logger.dev('useVoiceEvents: No socket available');
      return;
    }

    logger.dev('useVoiceEvents: Setting up global voice presence listeners');

    const handleUserJoined = (data: { channelId: string; user: VoicePresenceUserDto }) => {
      logger.dev('Voice user joined:', {
        channelId: data.channelId,
        userId: data.user.id,
        username: data.user.username
      });

      const queryKey = voicePresenceControllerGetChannelPresenceQueryKey({ path: { channelId: data.channelId } });
      const existing = queryClient.getQueryData<ChannelVoicePresenceResponseDto>(queryKey);

      if (existing) {
        queryClient.setQueryData<ChannelVoicePresenceResponseDto>(queryKey, (draft) => {
          if (!draft) return draft;
          const existingIndex = draft.users.findIndex(u => u.id === data.user.id);
          if (existingIndex === -1) {
            const newUsers = [...draft.users, data.user];
            return { ...draft, users: newUsers, count: newUsers.length };
          }
          return draft;
        });
      } else {
        // If cache doesn't exist, invalidate to trigger refetch when component loads
        queryClient.invalidateQueries({ queryKey: [{ _id: 'voicePresenceControllerGetChannelPresence' }] });
        queryClient.invalidateQueries({ queryKey: [{ _id: 'userVoicePresenceControllerGetMyVoiceChannels' }] });
        queryClient.invalidateQueries({ queryKey: [{ _id: 'dmVoicePresenceControllerGetDmPresence' }] });
      }
    };

    const handleUserLeft = (data: { channelId: string; userId: string }) => {
      logger.dev('Voice user left:', data);

      const queryKey = voicePresenceControllerGetChannelPresenceQueryKey({ path: { channelId: data.channelId } });
      const existing = queryClient.getQueryData<ChannelVoicePresenceResponseDto>(queryKey);

      if (existing) {
        queryClient.setQueryData<ChannelVoicePresenceResponseDto>(queryKey, (draft) => {
          if (!draft) return draft;
          const newUsers = draft.users.filter(u => u.id !== data.userId);
          return { ...draft, users: newUsers, count: newUsers.length };
        });
      } else {
        queryClient.invalidateQueries({ queryKey: [{ _id: 'voicePresenceControllerGetChannelPresence' }] });
        queryClient.invalidateQueries({ queryKey: [{ _id: 'userVoicePresenceControllerGetMyVoiceChannels' }] });
        queryClient.invalidateQueries({ queryKey: [{ _id: 'dmVoicePresenceControllerGetDmPresence' }] });
      }
    };

    const handleUserUpdated = (data: { channelId: string; user: VoicePresenceUserDto }) => {
      logger.dev('Voice user updated:', data);

      const queryKey = voicePresenceControllerGetChannelPresenceQueryKey({ path: { channelId: data.channelId } });
      const existing = queryClient.getQueryData<ChannelVoicePresenceResponseDto>(queryKey);

      if (existing) {
        queryClient.setQueryData<ChannelVoicePresenceResponseDto>(queryKey, (draft) => {
          if (!draft) return draft;
          const index = draft.users.findIndex(u => u.id === data.user.id);
          if (index !== -1) {
            const newUsers = [...draft.users];
            newUsers[index] = data.user;
            return { ...draft, users: newUsers };
          }
          return draft;
        });
      } else {
        queryClient.invalidateQueries({ queryKey: [{ _id: 'voicePresenceControllerGetChannelPresence' }] });
        queryClient.invalidateQueries({ queryKey: [{ _id: 'userVoicePresenceControllerGetMyVoiceChannels' }] });
        queryClient.invalidateQueries({ queryKey: [{ _id: 'dmVoicePresenceControllerGetDmPresence' }] });
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
  }, [socket, queryClient]);
};
