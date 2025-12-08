import { createApi } from "@reduxjs/toolkit/query/react";
import type { Register, User } from "../../types/auth.type";
import { createAuthedBaseQuery } from "../createBaseQuery";

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: createAuthedBaseQuery("users"),
  tagTypes: ["Profile", "User", "BlockedUsers"],
  endpoints: (builder) => ({
    register: builder.query<User, Register>({
      query: (body) => ({
        url: "/",
        method: "POST",
        body,
      }),
    }),
    profile: builder.query<User, void>({
      query: () => ({
        url: "/profile",
        method: "GET",
      }),
      providesTags: ["Profile"],
    }),
    updateProfile: builder.mutation<
      User,
      {
        displayName?: string;
        avatar?: string;
        banner?: string;
        bio?: string;
        status?: string;
      }
    >({
      query: (body) => ({
        url: "/profile",
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result) =>
        result ? ["Profile", { type: "User", id: result.id }] : ["Profile"],
    }),
    getUserById: builder.query<User, string>({
      query: (userId) => `/${userId}`,
      providesTags: (result, _error, userId) => [{ type: "User", id: userId }],
    }),
    searchUsers: builder.query<User[], { query: string; communityId?: string }>(
      {
        query: ({ query, communityId }) => ({
          url: "/search",
          method: "GET",
          params: {
            q: query,
            communityId,
          },
        }),
      }
    ),
    getAllUsers: builder.query<
      { users: User[]; continuationToken?: string },
      { limit?: number; continuationToken?: string }
    >({
      query: ({ limit = 20, continuationToken }) => ({
        url: "/",
        method: "GET",
        params: {
          limit,
          ...(continuationToken && { continuationToken }),
        },
      }),
    }),

    // User Blocking Endpoints
    blockUser: builder.mutation<{ success: boolean }, string>({
      query: (userId) => ({
        url: `/block/${userId}`,
        method: "POST",
      }),
      invalidatesTags: ["BlockedUsers"],
    }),
    unblockUser: builder.mutation<{ success: boolean }, string>({
      query: (userId) => ({
        url: `/block/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["BlockedUsers"],
    }),
    getBlockedUsers: builder.query<User[], void>({
      query: () => "/blocked",
      providesTags: ["BlockedUsers"],
    }),
    isUserBlocked: builder.query<{ blocked: boolean }, string>({
      query: (userId) => `/blocked/${userId}`,
    }),
  }),
});

export const {
  useLazyRegisterQuery,
  useProfileQuery,
  useUpdateProfileMutation,
  useGetUserByIdQuery,
  useLazySearchUsersQuery,
  useGetAllUsersQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
  useGetBlockedUsersQuery,
  useIsUserBlockedQuery,
} = usersApi;
