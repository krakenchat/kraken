import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Channel } from "../../types/channel.type";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

export interface CreateChannelDto {
  name: string;
  description?: string;
  type: "TEXT" | "VOICE";
  communityId: string;
  isPrivate?: boolean;
}

export interface UpdateChannelDto {
  name?: string;
  description?: string;
  isPrivate?: boolean;
}

export const channelApi = createApi({
  reducerPath: "channelApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/channels",
      prepareHeaders,
    })
  ),
  tagTypes: ["Channel"],
  endpoints: (builder) => ({
    getChannelsForCommunity: builder.query<Channel[], string>({
      query: (communityId) => ({
        url: `/community/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "Channel", id: `community-${communityId}` },
      ],
    }),
    getChannelById: builder.query<Channel, string>({
      query: (channelId) => ({
        url: `/${channelId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, channelId) => [
        { type: "Channel", id: channelId },
      ],
    }),
    createChannel: builder.mutation<Channel, CreateChannelDto>({
      query: (body) => ({
        url: "/",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { communityId }) => [
        { type: "Channel", id: `community-${communityId}` },
        "Channel",
      ],
    }),
    updateChannel: builder.mutation<
      Channel,
      { id: string; data: UpdateChannelDto }
    >({
      query: ({ id, data }) => ({
        url: `/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Channel", id },
        "Channel",
      ],
    }),
    deleteChannel: builder.mutation<void, string>({
      query: (channelId) => ({
        url: `/${channelId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, channelId) => [
        { type: "Channel", id: channelId },
        "Channel",
      ],
    }),
    getMentionableChannels: builder.query<Channel[], string>({
      query: (communityId) => ({
        url: `/community/${communityId}/mentionable`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "Channel", id: `mentionable-${communityId}` },
      ],
    }),
  }),
});

export const {
  useGetChannelsForCommunityQuery,
  useGetChannelByIdQuery,
  useCreateChannelMutation,
  useUpdateChannelMutation,
  useDeleteChannelMutation,
  useGetMentionableChannelsQuery,
} = channelApi;
