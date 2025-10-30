import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";

export interface UserPresenceResponse {
  userId: string;
  isOnline: boolean;
}

export interface BulkPresenceResponse {
  presence: Record<string, boolean>;
}

export const presenceApi = createApi({
  reducerPath: "presenceApi",
  baseQuery: createAuthedBaseQuery("presence"),
  tagTypes: ["Presence"],
  endpoints: (builder) => ({
    getUserPresence: builder.query<UserPresenceResponse, string>({
      query: (userId) => ({
        url: `/user/${userId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, userId) => [
        { type: "Presence", id: userId },
      ],
    }),
    
    getBulkPresence: builder.query<BulkPresenceResponse, void>({
      query: () => ({
        url: "/users/bulk",
        method: "GET",
      }),
      providesTags: [{ type: "Presence", id: "bulk" }],
    }),

    getMultipleUserPresence: builder.query<BulkPresenceResponse, string[]>({
      query: (userIds) => ({
        url: `/users/${userIds.join(',')}`,
        method: "GET",
      }),
      providesTags: (_result, _error, userIds) => [
        { type: "Presence", id: `multi-${userIds.join(',')}` },
        ...userIds.map((userId) => ({ type: "Presence" as const, id: userId })),
      ],
      // Refetch presence data every 60 seconds as fallback
      refetchOnMountOrArgChange: 60,
    }),
  }),
});

export const {
  useGetUserPresenceQuery,
  useGetBulkPresenceQuery,
  useGetMultipleUserPresenceQuery,
} = presenceApi;