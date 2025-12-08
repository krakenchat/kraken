import { createApi } from "@reduxjs/toolkit/query/react";
import type { User } from "../../types/auth.type";
import type {
  Friendship,
  PendingRequests,
  FriendshipStatusResponse,
} from "../../types/friend.type";
import { createAuthedBaseQuery } from "../createBaseQuery";

export const friendsApi = createApi({
  reducerPath: "friendsApi",
  baseQuery: createAuthedBaseQuery("friends"),
  tagTypes: ["Friends", "FriendRequests", "FriendshipStatus"],
  endpoints: (builder) => ({
    // Get all accepted friends
    getFriends: builder.query<User[], void>({
      query: () => "/",
      providesTags: ["Friends"],
    }),

    // Get pending requests (sent and received)
    getPendingRequests: builder.query<PendingRequests, void>({
      query: () => "/requests",
      providesTags: ["FriendRequests"],
    }),

    // Get friendship status with a specific user
    getFriendshipStatus: builder.query<FriendshipStatusResponse, string>({
      query: (userId) => `/status/${userId}`,
      providesTags: (_result, _error, userId) => [
        { type: "FriendshipStatus", id: userId },
      ],
    }),

    // Send a friend request
    sendFriendRequest: builder.mutation<Friendship, string>({
      query: (userId) => ({
        url: `/request/${userId}`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, userId) => [
        "FriendRequests",
        { type: "FriendshipStatus", id: userId },
      ],
    }),

    // Accept a friend request
    acceptFriendRequest: builder.mutation<Friendship, string>({
      query: (friendshipId) => ({
        url: `/accept/${friendshipId}`,
        method: "POST",
      }),
      invalidatesTags: ["Friends", "FriendRequests"],
    }),

    // Decline a friend request
    declineFriendRequest: builder.mutation<{ success: boolean }, string>({
      query: (friendshipId) => ({
        url: `/decline/${friendshipId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["FriendRequests"],
    }),

    // Cancel a sent friend request
    cancelFriendRequest: builder.mutation<{ success: boolean }, string>({
      query: (friendshipId) => ({
        url: `/cancel/${friendshipId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["FriendRequests"],
    }),

    // Remove a friend (unfriend)
    removeFriend: builder.mutation<{ success: boolean }, string>({
      query: (friendshipId) => ({
        url: `/${friendshipId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Friends"],
    }),
  }),
});

export const {
  useGetFriendsQuery,
  useGetPendingRequestsQuery,
  useGetFriendshipStatusQuery,
  useSendFriendRequestMutation,
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useCancelFriendRequestMutation,
  useRemoveFriendMutation,
} = friendsApi;
