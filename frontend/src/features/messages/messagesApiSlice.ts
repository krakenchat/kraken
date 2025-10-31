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
            if (continuationToken) {
              dispatch(
                appendMessages({
                  channelId,
                  messages: data.messages,
                  continuationToken: data.continuationToken,
                })
              );
            } else {
              dispatch(
                setMessages({
                  channelId,
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

          dispatch(
            updateMessage({
              channelId,
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
          dispatch(
            deleteMessage({
              channelId,
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
      { messageId: string; emoji: string }
    >({
      query: ({ messageId, emoji }) => ({
        url: "/reactions",
        method: "POST",
        body: { messageId, emoji },
      }),
    }),
    removeReaction: builder.mutation<
      Message,
      { messageId: string; emoji: string }
    >({
      query: ({ messageId, emoji }) => ({
        url: "/reactions",
        method: "DELETE",
        body: { messageId, emoji },
      }),
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async onQueryStarted({ messageId: _messageId }, { dispatch, queryFulfilled }) {
        try {
          const { data: updatedMessage } = await queryFulfilled;
          // Update message in Redux store if channelId is available
          if (updatedMessage.channelId) {
            dispatch(
              updateMessage({
                channelId: updatedMessage.channelId,
                message: updatedMessage,
              })
            );
          }
        } catch (error) {
          console.error("Failed to add attachment:", error);
        }
      },
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
} = messagesApi;
