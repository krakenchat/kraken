import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";
import { Message } from "../../types/message.type";

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
    }),
    // Add more endpoints as needed
  }),
});

export const { useGetMessagesByChannelQuery } = messagesApi;
