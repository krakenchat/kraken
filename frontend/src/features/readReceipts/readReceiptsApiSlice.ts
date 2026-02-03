import { createApi } from "@reduxjs/toolkit/query/react";
import { logger } from "../../utils/logger";
import { createAuthedBaseQuery } from "../createBaseQuery";
import {
  UnreadCount,
  MarkAsReadPayload,
  ReadReceipt,
  MessageReader,
} from "../../types/read-receipt.type";
import {
  setUnreadCounts,
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
          logger.error("Failed to fetch unread counts:", error);
        }
      },
    }),

    // Get unread count for a specific channel or DM group
    // Note: Data is available via RTK Query cache. The Redux slice (readReceiptsSlice)
    // is used for optimistic updates and WebSocket-driven updates.
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
      // Removed redundant dispatch to Redux slice - data is in RTK Query cache
      // The slice is updated by WebSocket events and optimistic updates only
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
          logger.error("Failed to mark as read, rolled back:", error);
        }
      },
    }),

    // Get users who have read a specific message (for "seen by" tooltip)
    getMessageReaders: builder.query<
      MessageReader[],
      { messageId: string; channelId?: string; directMessageGroupId?: string }
    >({
      query: ({ messageId, channelId, directMessageGroupId }) => {
        const params = new URLSearchParams();
        if (channelId) params.append("channelId", channelId);
        if (directMessageGroupId)
          params.append("directMessageGroupId", directMessageGroupId);
        return {
          url: `/message/${messageId}/readers?${params.toString()}`,
          method: "GET",
        };
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
  useGetMessageReadersQuery,
  useLazyGetMessageReadersQuery,
} = readReceiptsApi;
