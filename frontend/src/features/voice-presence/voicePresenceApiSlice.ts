import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";
import { RootState } from "../../app/store";

export interface VoicePresenceUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: string;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

export interface ChannelPresenceResponse {
  channelId: string;
  users: VoicePresenceUser[];
  count: number;
}

export interface VoiceStateUpdate {
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}

export interface UserVoiceChannelsResponse {
  userId: string;
  voiceChannels: string[];
}

export interface VoiceActionResponse {
  success: boolean;
  message: string;
  channelId: string;
}

export const voicePresenceApi = createApi({
  reducerPath: "voicePresenceApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api",
      prepareHeaders,
    })
  ),
  tagTypes: ["VoicePresence"],
  endpoints: (builder) => ({
    getChannelPresence: builder.query<ChannelPresenceResponse, string>({
      query: (channelId) => ({
        url: `/channels/${channelId}/voice-presence`,
        method: "GET",
      }),
      providesTags: (result, error, channelId) => [
        { type: "VoicePresence", id: channelId },
      ],
    }),
    joinVoiceChannel: builder.mutation<VoiceActionResponse, string>({
      query: (channelId) => ({
        url: `/channels/${channelId}/voice-presence/join`,
        method: "POST",
      }),
      invalidatesTags: (result, error, channelId) => [
        { type: "VoicePresence", id: channelId },
      ],
    }),
    leaveVoiceChannel: builder.mutation<VoiceActionResponse, string>({
      query: (channelId) => ({
        url: `/channels/${channelId}/voice-presence/leave`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, channelId) => [
        { type: "VoicePresence", id: channelId },
      ],
    }),
    updateVoiceState: builder.mutation<
      VoiceActionResponse,
      { channelId: string; updates: VoiceStateUpdate }
    >({
      query: ({ channelId, updates }) => ({
        url: `/channels/${channelId}/voice-presence/state`,
        method: "PUT",
        body: updates,
      }),
      // Don't invalidate cache - rely on optimistic updates and WebSocket events for real-time updates
      // invalidatesTags: (result, error, { channelId }) => [
      //   { type: "VoicePresence", id: channelId },
      // ],
      // Optimistic update to preserve existing state and reduce flicker
      onQueryStarted: async ({ channelId, updates }, { dispatch, queryFulfilled, getState }) => {
        
        // Get current user ID from profile query cache
        const state = getState() as RootState;
        const profileQueryState = state.usersApi?.queries?.[`profile(undefined)`];
        const currentUserId = profileQueryState?.data?.id;
        
        const patchResult = dispatch(
          voicePresenceApi.util.updateQueryData('getChannelPresence', channelId, (draft) => {
            if (currentUserId) {
              const userIndex = draft.users.findIndex(user => user.id === currentUserId);
              if (userIndex !== -1) {
                // Preserve existing state and only update the provided fields
                const existingUser = draft.users[userIndex];
                
                const updatedUser = {
                  ...existingUser,
                  ...updates,
                  // Ensure undefined values don't overwrite existing values
                  isMuted: updates.isMuted !== undefined ? updates.isMuted : existingUser.isMuted,
                  isDeafened: updates.isDeafened !== undefined ? updates.isDeafened : existingUser.isDeafened,
                  isVideoEnabled: updates.isVideoEnabled !== undefined ? updates.isVideoEnabled : existingUser.isVideoEnabled,
                  isScreenSharing: updates.isScreenSharing !== undefined ? updates.isScreenSharing : existingUser.isScreenSharing,
                };
                draft.users[userIndex] = updatedUser;
              }
            }
          })
        );
        
        try {
          await queryFulfilled;
        } catch (error) {
          patchResult.undo();
          throw error;
        }
      },
    }),
    refreshPresence: builder.mutation<VoiceActionResponse, string>({
      query: (channelId) => ({
        url: `/channels/${channelId}/voice-presence/refresh`,
        method: "POST",
      }),
    }),
    getMyVoiceChannels: builder.query<UserVoiceChannelsResponse, void>({
      query: () => ({
        url: `/voice-presence/me`,
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetChannelPresenceQuery,
  useJoinVoiceChannelMutation,
  useLeaveVoiceChannelMutation,
  useUpdateVoiceStateMutation,
  useRefreshPresenceMutation,
  useGetMyVoiceChannelsQuery,
} = voicePresenceApi;