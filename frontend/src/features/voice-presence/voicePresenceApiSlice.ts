import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";

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
}

export interface ChannelPresenceResponse {
  channelId: string;
  users: VoicePresenceUser[];
  count: number;
}

export interface UserVoiceChannelsResponse {
  userId: string;
  voiceChannels: string[];
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
    refreshPresence: builder.mutation<{ success: boolean; message: string; channelId: string }, string>({
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
    getDmPresence: builder.query<DmPresenceResponse, string>({
      query: (dmGroupId) => ({
        url: `/dm-groups/${dmGroupId}/voice-presence`,
        method: "GET",
      }),
      providesTags: (result, error, dmGroupId) => [
        { type: "VoicePresence", id: `dm-${dmGroupId}` },
      ],
    }),
  }),
});

export const {
  useGetChannelPresenceQuery,
  useRefreshPresenceMutation,
  useGetMyVoiceChannelsQuery,
  useGetDmPresenceQuery,
} = voicePresenceApi;
