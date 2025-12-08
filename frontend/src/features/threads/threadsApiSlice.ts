import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";
import { Message, Span } from "../../types/message.type";
import {
  setThreadReplies,
  appendThreadReplies,
  setThreadLoading,
  setSubscription,
} from "./threadsSlice";

interface ThreadRepliesResponse {
  replies: Message[];
  continuationToken?: string;
}

interface ThreadMetadata {
  parentMessageId: string;
  replyCount: number;
  lastReplyAt: string | null;
  isSubscribed: boolean;
}

export const threadsApi = createApi({
  reducerPath: "threadsApi",
  baseQuery: createAuthedBaseQuery("threads"),
  tagTypes: ["ThreadReplies", "ThreadMetadata"],
  endpoints: (builder) => ({
    /**
     * Get paginated replies for a thread
     */
    getThreadReplies: builder.query<
      ThreadRepliesResponse,
      { parentMessageId: string; limit?: number; continuationToken?: string }
    >({
      query: ({ parentMessageId, limit = 50, continuationToken }) => {
        let url = `/${parentMessageId}/replies?limit=${limit}`;
        if (continuationToken) url += `&continuationToken=${continuationToken}`;
        return { url, method: "GET" };
      },
      providesTags: (_, __, { parentMessageId }) => [
        { type: "ThreadReplies", id: parentMessageId },
      ],
      async onQueryStarted(
        { parentMessageId, continuationToken },
        { dispatch, queryFulfilled }
      ) {
        dispatch(setThreadLoading({ parentMessageId, isLoading: true }));
        try {
          const { data } = await queryFulfilled;
          if (data && data.replies) {
            if (continuationToken) {
              dispatch(
                appendThreadReplies({
                  parentMessageId,
                  replies: data.replies,
                  continuationToken: data.continuationToken,
                })
              );
            } else {
              dispatch(
                setThreadReplies({
                  parentMessageId,
                  replies: data.replies,
                  continuationToken: data.continuationToken,
                })
              );
            }
          }
        } catch (error) {
          console.error("Failed to fetch thread replies:", error);
          dispatch(setThreadLoading({ parentMessageId, isLoading: false }));
        }
      },
    }),

    /**
     * Get thread metadata (reply count, subscription status)
     */
    getThreadMetadata: builder.query<ThreadMetadata, string>({
      query: (parentMessageId) => ({
        url: `/${parentMessageId}/metadata`,
        method: "GET",
      }),
      providesTags: (_, __, parentMessageId) => [
        { type: "ThreadMetadata", id: parentMessageId },
      ],
      async onQueryStarted(parentMessageId, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data) {
            dispatch(
              setSubscription({
                parentMessageId,
                isSubscribed: data.isSubscribed,
              })
            );
          }
        } catch (error) {
          console.error("Failed to fetch thread metadata:", error);
        }
      },
    }),

    /**
     * Create a thread reply via REST (fallback, prefer WebSocket)
     */
    createThreadReply: builder.mutation<
      Message,
      {
        parentMessageId: string;
        spans: Span[];
        attachments?: string[];
        pendingAttachments?: number;
      }
    >({
      query: ({ parentMessageId, spans, attachments, pendingAttachments }) => ({
        url: `/${parentMessageId}/replies`,
        method: "POST",
        body: { spans, attachments, pendingAttachments },
      }),
      invalidatesTags: (_, __, { parentMessageId }) => [
        { type: "ThreadReplies", id: parentMessageId },
        { type: "ThreadMetadata", id: parentMessageId },
      ],
    }),

    /**
     * Subscribe to a thread
     */
    subscribeToThread: builder.mutation<void, string>({
      query: (parentMessageId) => ({
        url: `/${parentMessageId}/subscribe`,
        method: "POST",
      }),
      async onQueryStarted(parentMessageId, { dispatch, queryFulfilled }) {
        // Optimistic update
        dispatch(setSubscription({ parentMessageId, isSubscribed: true }));
        try {
          await queryFulfilled;
        } catch (error) {
          // Revert on error
          dispatch(setSubscription({ parentMessageId, isSubscribed: false }));
          console.error("Failed to subscribe to thread:", error);
        }
      },
      invalidatesTags: (_, __, parentMessageId) => [
        { type: "ThreadMetadata", id: parentMessageId },
      ],
    }),

    /**
     * Unsubscribe from a thread
     */
    unsubscribeFromThread: builder.mutation<void, string>({
      query: (parentMessageId) => ({
        url: `/${parentMessageId}/subscribe`,
        method: "DELETE",
      }),
      async onQueryStarted(parentMessageId, { dispatch, queryFulfilled }) {
        // Optimistic update
        dispatch(setSubscription({ parentMessageId, isSubscribed: false }));
        try {
          await queryFulfilled;
        } catch (error) {
          // Revert on error
          dispatch(setSubscription({ parentMessageId, isSubscribed: true }));
          console.error("Failed to unsubscribe from thread:", error);
        }
      },
      invalidatesTags: (_, __, parentMessageId) => [
        { type: "ThreadMetadata", id: parentMessageId },
      ],
    }),
  }),
});

export const {
  useGetThreadRepliesQuery,
  useLazyGetThreadRepliesQuery,
  useGetThreadMetadataQuery,
  useLazyGetThreadMetadataQuery,
  useCreateThreadReplyMutation,
  useSubscribeToThreadMutation,
  useUnsubscribeFromThreadMutation,
} = threadsApi;
