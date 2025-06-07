import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

export interface CreateChannelMembershipDto {
  userId: string;
  channelId: string;
  role?: "MEMBER" | "MODERATOR" | "ADMIN";
}

export interface ChannelMembershipResponseDto {
  id: string;
  userId: string;
  channelId: string;
  joinedAt: string;
  role: "MEMBER" | "MODERATOR" | "ADMIN";
  addedBy?: string;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  channel?: {
    id: string;
    name: string;
    communityId: string;
    isPrivate: boolean;
  };
}

export const channelMembershipApi = createApi({
  reducerPath: "channelMembershipApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/channel-membership",
      prepareHeaders,
    })
  ),
  tagTypes: ["ChannelMembership"],
  endpoints: (builder) => ({
    // Create channel membership (add member to private channel)
    createChannelMembership: builder.mutation<
      ChannelMembershipResponseDto,
      CreateChannelMembershipDto
    >({
      query: (body) => ({
        url: "/",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { channelId }) => [
        { type: "ChannelMembership", id: `channel-${channelId}` },
        "ChannelMembership",
      ],
    }),

    // Get all members for a private channel
    getMembersForChannel: builder.query<ChannelMembershipResponseDto[], string>(
      {
        query: (channelId) => ({
          url: `/channel/${channelId}`,
          method: "GET",
        }),
        providesTags: (_result, _error, channelId) => [
          { type: "ChannelMembership", id: `channel-${channelId}` },
        ],
      }
    ),

    // Get channel memberships for a user
    getChannelMembershipsForUser: builder.query<
      ChannelMembershipResponseDto[],
      string
    >({
      query: (userId) => ({
        url: `/user/${userId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, userId) => [
        { type: "ChannelMembership", id: `user-${userId}` },
      ],
    }),

    // Get my channel memberships
    getMyChannelMemberships: builder.query<
      ChannelMembershipResponseDto[],
      void
    >({
      query: () => ({
        url: "/my",
        method: "GET",
      }),
      providesTags: [{ type: "ChannelMembership", id: "my" }],
    }),

    // Get specific channel membership
    getChannelMembership: builder.query<
      ChannelMembershipResponseDto,
      { userId: string; channelId: string }
    >({
      query: ({ userId, channelId }) => ({
        url: `/channel/${channelId}/user/${userId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, { userId, channelId }) => [
        { type: "ChannelMembership", id: `${userId}-${channelId}` },
      ],
    }),

    // Remove member from private channel
    removeChannelMembership: builder.mutation<
      void,
      { userId: string; channelId: string }
    >({
      query: ({ userId, channelId }) => ({
        url: `/channel/${channelId}/user/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { userId, channelId }) => [
        { type: "ChannelMembership", id: `channel-${channelId}` },
        { type: "ChannelMembership", id: `user-${userId}` },
        { type: "ChannelMembership", id: `${userId}-${channelId}` },
        "ChannelMembership",
      ],
    }),

    // Leave private channel
    leaveChannel: builder.mutation<void, string>({
      query: (channelId) => ({
        url: `/leave/${channelId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, channelId) => [
        { type: "ChannelMembership", id: `channel-${channelId}` },
        { type: "ChannelMembership", id: "my" },
        "ChannelMembership",
      ],
    }),
  }),
});

export const {
  useCreateChannelMembershipMutation,
  useGetMembersForChannelQuery,
  useGetChannelMembershipsForUserQuery,
  useGetMyChannelMembershipsQuery,
  useGetChannelMembershipQuery,
  useRemoveChannelMembershipMutation,
  useLeaveChannelMutation,
} = channelMembershipApi;
