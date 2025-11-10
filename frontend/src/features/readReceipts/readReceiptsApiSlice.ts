import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";
import {
  UnreadCount,
  MarkAsReadPayload,
  ReadReceipt,
} from "../../types/read-receipt.type";
import {
  setUnreadCounts,
  updateUnreadCount,
  markAsRead,
} from "./readReceiptsSlice";

export const readReceiptsApi = createApi({
  reducerPath: "readReceiptsApi",
  baseQuery: createAuthedBaseQuery("read-receipts"),
  tagTypes: ["UnreadCounts"],
  endpoints: (builder) => ({
    // Get all unread counts for the current user
    getUnreadCounts: builder.query<UnreadCount[], void>({
      query: () => ({
        url: "/unread-counts",
        method: "GET",
      }),
      providesTags: ["UnreadCounts"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUnreadCounts(data));
        } catch (error) {
          console.error("Failed to fetch unread counts:", error);
        }
      },
    }),

    // Get unread count for a specific channel or DM group
    getUnreadCount: builder.query<
      UnreadCount,
      { channelId?: string; directMessageGroupId?: string }
    >({
      query: ({ channelId, directMessageGroupId }) => {
        const params = new URLSearchParams();
        if (channelId) params.append("channelId", channelId);
        if (directMessageGroupId)
          params.append("directMessageGroupId", directMessageGroupId);
        return {
          url: `/unread-count?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: (_result, _error, arg) => [
        {
          type: "UnreadCounts" as const,
          id: arg.channelId || arg.directMessageGroupId,
        },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(updateUnreadCount(data));
        } catch (error) {
          console.error("Failed to fetch unread count:", error);
        }
      },
    }),

    // Get last read message ID for a channel or DM group
    getLastReadMessageId: builder.query<
      { lastReadMessageId: string | null },
      { channelId?: string; directMessageGroupId?: string }
    >({
      query: ({ channelId, directMessageGroupId }) => {
        const params = new URLSearchParams();
        if (channelId) params.append("channelId", channelId);
        if (directMessageGroupId)
          params.append("directMessageGroupId", directMessageGroupId);
        return {
          url: `/last-read?${params.toString()}`,
          method: "GET",
        };
      },
    }),

    // Mark messages as read up to a specific message
    markAsRead: builder.mutation<ReadReceipt, MarkAsReadPayload>({
      query: (payload) => ({
        url: "/mark-read",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        "UnreadCounts",
        {
          type: "UnreadCounts" as const,
          id: arg.channelId || arg.directMessageGroupId,
        },
      ],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        // Optimistically update the Redux state BEFORE the server responds
        const patchResult = dispatch(
          markAsRead({
            channelId: arg.channelId,
            directMessageGroupId: arg.directMessageGroupId,
            lastReadMessageId: arg.lastReadMessageId,
          })
        );

        try {
          await queryFulfilled;
          // Server confirmed - optimistic update was correct
        } catch (error) {
          // Rollback on error by inverting the update
          patchResult.undo();
          console.error("Failed to mark as read, rolled back:", error);
        }
      },
    }),
  }),
});

export const {
  useGetUnreadCountsQuery,
  useLazyGetUnreadCountsQuery,
  useGetUnreadCountQuery,
  useLazyGetUnreadCountQuery,
  useGetLastReadMessageIdQuery,
  useLazyGetLastReadMessageIdQuery,
  useMarkAsReadMutation,
} = readReceiptsApi;
