import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";
import { Message } from "../../types/message.type";
import {
  setMessages,
  appendMessages,
  updateMessage,
  deleteMessage,
} from "./messagesSlice";

export const messagesApi = createApi({
  reducerPath: "messagesApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/messages",
      prepareHeaders,
    })
  ),
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
      { id: string; channelId: string; data: Partial<Message> }
    >({
      query: ({ id, data }) => ({
        url: `/${id}`,
        method: "PATCH",
        body: data,
      }),
      async onQueryStarted({ channelId }, { dispatch, queryFulfilled }) {
        try {
          const { data: updatedMessage } = await queryFulfilled;
          dispatch(
            updateMessage({
              channelId,
              message: updatedMessage,
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
  }),
});

export const {
  useGetMessagesByChannelQuery,
  useUpdateMessageMutation,
  useDeleteMessageMutation,
} = messagesApi;
