import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";
import { Message } from "../../types/message.type";
import { setMessages, appendMessages } from "./messagesSlice";

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
      query: ({ channelId, limit = 50, continuationToken }) => {
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
              // This is pagination - append to existing messages
              dispatch(
                appendMessages({
                  channelId,
                  messages: data.messages,
                  continuationToken: data.continuationToken,
                })
              );
            } else {
              // This is initial load - replace all messages
              dispatch(
                setMessages({
                  channelId,
                  messages: data.messages,
                  continuationToken: data.continuationToken,
                })
              );
            }
          }
        } catch {
          // Query failed, no need to update Redux slice
        }
      },
    }),
    // Add more endpoints as needed
  }),
});

export const { useGetMessagesByChannelQuery } = messagesApi;
