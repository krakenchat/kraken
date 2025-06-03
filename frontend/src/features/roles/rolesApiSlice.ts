import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { UserRoles } from "../../types/roles.type";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

export const rolesApi = createApi({
  reducerPath: "rolesApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/roles",
      prepareHeaders,
    })
  ),
  endpoints: (builder) => ({
    // Get my roles for a community
    getMyRolesForCommunity: builder.query<UserRoles, string>({
      query: (communityId) => ({
        url: `/my/community/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "UserRoles", id: `my-community-${communityId}` },
      ],
    }),

    // Get my roles for a channel
    getMyRolesForChannel: builder.query<UserRoles, string>({
      query: (channelId) => ({
        url: `/my/channel/${channelId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, channelId) => [
        { type: "UserRoles", id: `my-channel-${channelId}` },
      ],
    }),

    // Get my instance roles
    getMyInstanceRoles: builder.query<UserRoles, void>({
      query: () => ({
        url: "/my/instance",
        method: "GET",
      }),
      providesTags: [{ type: "UserRoles", id: "my-instance" }],
    }),

    // Get another user's roles for a community
    getUserRolesForCommunity: builder.query<
      UserRoles,
      { userId: string; communityId: string }
    >({
      query: ({ userId, communityId }) => ({
        url: `/user/${userId}/community/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, { userId, communityId }) => [
        { type: "UserRoles", id: `${userId}-community-${communityId}` },
      ],
    }),

    // Get another user's roles for a channel
    getUserRolesForChannel: builder.query<
      UserRoles,
      { userId: string; channelId: string }
    >({
      query: ({ userId, channelId }) => ({
        url: `/user/${userId}/channel/${channelId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, { userId, channelId }) => [
        { type: "UserRoles", id: `${userId}-channel-${channelId}` },
      ],
    }),

    // Get another user's instance roles
    getUserInstanceRoles: builder.query<UserRoles, string>({
      query: (userId) => ({
        url: `/user/${userId}/instance`,
        method: "GET",
      }),
      providesTags: (_result, _error, userId) => [
        { type: "UserRoles", id: `${userId}-instance` },
      ],
    }),
  }),
  tagTypes: ["UserRoles"],
});

export const {
  useGetMyRolesForCommunityQuery,
  useGetMyRolesForChannelQuery,
  useGetMyInstanceRolesQuery,
  useGetUserRolesForCommunityQuery,
  useGetUserRolesForChannelQuery,
  useGetUserInstanceRolesQuery,
} = rolesApi;
