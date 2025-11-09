import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";
import { RootState } from "../../app/store";

/**
 * Voice presence user from server
 *
 * NOTE: Media states (video, screen share, muted) are now managed by LiveKit.
 * The server only stores isDeafened (custom UI state).
 *
 * Frontend components should:
 * 1. Use useParticipantTracks() to get LiveKit state for users in the room
 * 2. Only fall back to server state for users not yet in LiveKit
 */
export interface VoicePresenceUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: string;
  // Only custom state stored on server now:
  isDeafened: boolean;
  // Legacy fields (no longer sent by server, kept for backward compatibility):
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  isMuted?: boolean;
}

export interface ChannelPresenceResponse {
  channelId: string;
  users: VoicePresenceUser[];
  count: number;
}

/**
 * Voice state update DTO
 *
 * NOTE: Only isDeafened is sent to server now.
 * Media states are managed by LiveKit.
 */
export interface VoiceStateUpdate {
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

export interface DmVoiceActionResponse {
  success: boolean;
  message: string;
  dmGroupId: string;
}

export interface DmPresenceResponse {
  dmGroupId: string;
  users: VoicePresenceUser[];
  count: number;
}

export const voicePresenceApi = createApi({
  reducerPath: "voicePresenceApi",
  baseQuery: createAuthedBaseQuery(""),
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
      // Optimistic update for isDeafened (media state now managed by LiveKit)
      onQueryStarted: async ({ channelId, updates }, { dispatch, queryFulfilled, getState }) => {
        // Get current user ID from profile query cache
        const state = getState() as RootState;
        const profileQueryState = state.usersApi?.queries?.[`profile(undefined)`];
        const currentUserId = profileQueryState?.data?.id;

        const patchResult = dispatch(
          voicePresenceApi.util.updateQueryData('getChannelPresence', channelId, (draft) => {
            if (currentUserId && updates.isDeafened !== undefined) {
              const userIndex = draft.users.findIndex(user => user.id === currentUserId);
              if (userIndex !== -1) {
                // Only update isDeafened (media state comes from LiveKit)
                draft.users[userIndex].isDeafened = updates.isDeafened;
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

    // DM Voice Presence Endpoints
    getDmPresence: builder.query<DmPresenceResponse, string>({
      query: (dmGroupId) => ({
        url: `/dm-groups/${dmGroupId}/voice-presence`,
        method: "GET",
      }),
      providesTags: (result, error, dmGroupId) => [
        { type: "VoicePresence", id: `dm-${dmGroupId}` },
      ],
    }),
    joinDmVoice: builder.mutation<DmVoiceActionResponse, string>({
      query: (dmGroupId) => ({
        url: `/dm-groups/${dmGroupId}/voice-presence/join`,
        method: "POST",
      }),
      invalidatesTags: (result, error, dmGroupId) => [
        { type: "VoicePresence", id: `dm-${dmGroupId}` },
      ],
    }),
    leaveDmVoice: builder.mutation<DmVoiceActionResponse, string>({
      query: (dmGroupId) => ({
        url: `/dm-groups/${dmGroupId}/voice-presence/leave`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, dmGroupId) => [
        { type: "VoicePresence", id: `dm-${dmGroupId}` },
      ],
    }),
    updateDmVoiceState: builder.mutation<
      DmVoiceActionResponse,
      { dmGroupId: string; updates: VoiceStateUpdate }
    >({
      query: ({ dmGroupId, updates }) => ({
        url: `/dm-groups/${dmGroupId}/voice-presence/state`,
        method: "PUT",
        body: updates,
      }),
      // Optimistic update for DM voice state
      // Optimistic update for isDeafened (media state now managed by LiveKit)
      onQueryStarted: async ({ dmGroupId, updates }, { dispatch, queryFulfilled, getState }) => {
        const state = getState() as RootState;
        const profileQueryState = state.usersApi?.queries?.[`profile(undefined)`];
        const currentUserId = profileQueryState?.data?.id;

        const patchResult = dispatch(
          voicePresenceApi.util.updateQueryData('getDmPresence', dmGroupId, (draft) => {
            if (currentUserId && updates.isDeafened !== undefined) {
              const userIndex = draft.users.findIndex(user => user.id === currentUserId);
              if (userIndex !== -1) {
                // Only update isDeafened (media state comes from LiveKit)
                draft.users[userIndex].isDeafened = updates.isDeafened;
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
  }),
});

export const {
  useGetChannelPresenceQuery,
  useJoinVoiceChannelMutation,
  useLeaveVoiceChannelMutation,
  useUpdateVoiceStateMutation,
  useRefreshPresenceMutation,
  useGetMyVoiceChannelsQuery,
  useGetDmPresenceQuery,
  useJoinDmVoiceMutation,
  useLeaveDmVoiceMutation,
  useUpdateDmVoiceStateMutation,
} = voicePresenceApi;