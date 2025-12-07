import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";
import { Message } from "../../types/message.type";
import {
  setMessages,
  appendMessages,
  updateMessage,
  deleteMessage,
} from "./messagesSlice";

export const messagesApi = createApi({
  reducerPath: "messagesApi",
  baseQuery: createAuthedBaseQuery("messages"),
  endpoints: (builder) => ({
    getMessagesByChannel: builder.query<
      { messages: Message[]; continuationToken?: string },
      { channelId: string; limit?: number; continuationToken?: string }
    >({
      query: ({ channelId, limit = 25, continuationToken }) => {
        let url = `/channel/${channelId}?limit=${limit}`;
        if (continuationToken) url += `&continuationToken=${continuationToken}`;
        return {
          url,
          method: "GET",
        };
      },
      async onQueryStarted(
        { channelId, continuationToken },
        { dispatch, queryFulfilled }
      ) {
        try {
          const { data } = await queryFulfilled;
          // Only dispatch to Redux slice if we actually got data
          if (data && data.messages) {
            // channelId is the context ID for channel messages
            const contextId = channelId;
            if (continuationToken) {
              dispatch(
                appendMessages({
                  contextId,
                  messages: data.messages,
                  continuationToken: data.continuationToken,
                })
              );
            } else {
              dispatch(
                setMessages({
                  contextId,
                  messages: data.messages,
                  continuationToken: data.continuationToken,
                })
              );
            }
          }
        } catch (error) {
          console.error("Failed to fetch messages:", error);
        }
      },
    }),
    updateMessage: builder.mutation<
      Message,
      { id: string; channelId: string; data: Partial<Message>; originalAttachments?: Message['attachments'] }
    >({
      query: ({ id, data }) => ({
        url: `/${id}`,
        method: "PATCH",
        body: data,
      }),
      async onQueryStarted({ channelId, originalAttachments }, { dispatch, queryFulfilled }) {
        try {
          const { data: updatedMessage } = await queryFulfilled;

          // If we have original attachments metadata, enrich the response
          // Backend returns attachment IDs as strings, we need to convert back to FileMetadata
          let enrichedMessage = updatedMessage;
          if (originalAttachments && Array.isArray(updatedMessage.attachments)) {
            const attachmentMap = new Map(originalAttachments.map(att => [att.id, att]));
            enrichedMessage = {
              ...updatedMessage,
              attachments: updatedMessage.attachments
                .map((idOrObj: string | FileMetadata) => {
                  // If it's already an object with metadata, use it
                  if (typeof idOrObj === 'object' && idOrObj.id) return idOrObj;
                  // If it's just an ID string, look up the metadata
                  if (typeof idOrObj === 'string') return attachmentMap.get(idOrObj);
                  return idOrObj;
                })
                .filter(Boolean) as Message['attachments'],
            };
          }

          // channelId is the context ID for channel messages
          dispatch(
            updateMessage({
              contextId: channelId,
              message: enrichedMessage,
            })
          );
        } catch (error) {
          console.error("Failed to update message:", error);
        }
      },
    }),
    deleteMessage: builder.mutation<void, { id: string; channelId: string }>({
      query: ({ id }) => ({
        url: `/${id}`,
        method: "DELETE",
      }),
      async onQueryStarted({ id, channelId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // channelId is the context ID for channel messages
          dispatch(
            deleteMessage({
              contextId: channelId,
              id,
            })
          );
        } catch (error) {
          console.error("Failed to delete message:", error);
        }
      },
    }),
    addReaction: builder.mutation<
      Message,
      { messageId: string; emoji: string; channelId?: string }
    >({
      query: ({ messageId, emoji }) => ({
        url: "/reactions",
        method: "POST",
        body: { messageId, emoji },
      }),
      async onQueryStarted({ channelId: argChannelId }, { dispatch, queryFulfilled }) {
        try {
          const { data: updatedMessage } = await queryFulfilled;
          // Determine context ID from arg or response (could be channel or DM)
          const contextId = argChannelId || updatedMessage.channelId || updatedMessage.directMessageGroupId;
          if (contextId) {
            dispatch(
              updateMessage({
                contextId,
                message: updatedMessage,
              })
            );
          }
        } catch (error) {
          console.error("Failed to add reaction:", error);
        }
      },
    }),
    removeReaction: builder.mutation<
      Message,
      { messageId: string; emoji: string; channelId?: string }
    >({
      query: ({ messageId, emoji }) => ({
        url: "/reactions",
        method: "DELETE",
        body: { messageId, emoji },
      }),
      async onQueryStarted({ channelId: argChannelId }, { dispatch, queryFulfilled }) {
        try {
          const { data: updatedMessage } = await queryFulfilled;
          // Determine context ID from arg or response (could be channel or DM)
          const contextId = argChannelId || updatedMessage.channelId || updatedMessage.directMessageGroupId;
          if (contextId) {
            dispatch(
              updateMessage({
                contextId,
                message: updatedMessage,
              })
            );
          }
        } catch (error) {
          console.error("Failed to remove reaction:", error);
        }
      },
    }),
    addAttachment: builder.mutation<
      Message,
      { messageId: string; fileId?: string }
    >({
      query: ({ messageId, fileId }) => ({
        url: `/${messageId}/attachments`,
        method: "POST",
        body: { fileId },
      }),

      async onQueryStarted({ messageId: _messageId }, { dispatch, queryFulfilled }) {
        try {
          const { data: updatedMessage } = await queryFulfilled;
          // Determine context ID (could be channel or DM)
          const contextId = updatedMessage.channelId || updatedMessage.directMessageGroupId;
          if (contextId) {
            dispatch(
              updateMessage({
                contextId,
                message: updatedMessage,
              })
            );
          }
        } catch (error) {
          console.error("Failed to add attachment:", error);
        }
      },
    }),
    searchChannelMessages: builder.query<
      Message[],
      { channelId: string; query: string; limit?: number }
    >({
      query: ({ channelId, query, limit = 50 }) => ({
        url: `/search/channel/${channelId}?q=${encodeURIComponent(query)}&limit=${limit}`,
        method: "GET",
      }),
    }),
    searchDirectMessages: builder.query<
      Message[],
      { groupId: string; query: string; limit?: number }
    >({
      query: ({ groupId, query, limit = 50 }) => ({
        url: `/search/group/${groupId}?q=${encodeURIComponent(query)}&limit=${limit}`,
        method: "GET",
      }),
    }),
    searchCommunityMessages: builder.query<
      (Message & { channelName: string })[],
      { communityId: string; query: string; limit?: number }
    >({
      query: ({ communityId, query, limit = 50 }) => ({
        url: `/search/community/${communityId}?q=${encodeURIComponent(query)}&limit=${limit}`,
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetMessagesByChannelQuery,
  useLazyGetMessagesByChannelQuery,
  useUpdateMessageMutation,
  useDeleteMessageMutation,
  useAddReactionMutation,
  useRemoveReactionMutation,
  useAddAttachmentMutation,
  useSearchChannelMessagesQuery,
  useLazySearchChannelMessagesQuery,
  useSearchDirectMessagesQuery,
  useLazySearchDirectMessagesQuery,
  useSearchCommunityMessagesQuery,
  useLazySearchCommunityMessagesQuery,
} = messagesApi;
