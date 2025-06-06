import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Channel } from "../../types/channel.type";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

export const channelApi = createApi({
  reducerPath: "channelApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/channels",
      prepareHeaders,
    })
  ),
  endpoints: (builder) => ({
    getChannelsForCommunity: builder.query<Channel[], string>({
      query: (communityId) => ({
        url: `/community/${communityId}`,
        method: "GET",
      }),
    }),
    getChannelById: builder.query<Channel, string>({
      query: (channelId) => ({
        url: `/${channelId}`,
        method: "GET",
      }),
    }),
  }),
});

export const { useGetChannelsForCommunityQuery, useGetChannelByIdQuery } = channelApi;
