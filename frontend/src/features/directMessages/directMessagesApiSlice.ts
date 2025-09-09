import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";
import {
  DirectMessageGroup,
  CreateDmGroupDto,
  AddMembersDto,
} from "../../types/direct-message.type";
import { Message } from "../../types/message.type";
import { setMessages } from "../messages/messagesSlice";

export const directMessagesApi = createApi({
  reducerPath: "directMessagesApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/direct-messages",
      prepareHeaders,
    })
  ),
  tagTypes: ["DirectMessageGroup", "DirectMessages"],
  endpoints: (builder) => ({
    getUserDmGroups: builder.query<DirectMessageGroup[], void>({
      query: () => "/",
      providesTags: ["DirectMessageGroup"],
    }),
    createDmGroup: builder.mutation<DirectMessageGroup, CreateDmGroupDto>({
      query: (body) => ({
        url: "/",
        method: "POST",
        body,
      }),
      invalidatesTags: ["DirectMessageGroup"],
    }),
    getDmGroup: builder.query<DirectMessageGroup, string>({
      query: (id) => `/${id}`,
      providesTags: (result, error, id) => [{ type: "DirectMessageGroup", id }],
    }),
    getDmMessages: builder.query<
      { messages: Message[]; continuationToken?: string },
      string
    >({
      query: (dmGroupId) => `/${dmGroupId}/messages`,
      providesTags: (result, error, dmGroupId) => [
        { type: "DirectMessages", id: dmGroupId },
      ],
      async onQueryStarted(dmGroupId, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Populate Redux store with DM messages, just like channel messages
          if (data && data.messages) {
            dispatch(
              setMessages({
                channelId: dmGroupId, // Use dmGroupId as channelId in the store
                messages: data.messages,
                continuationToken: data.continuationToken,
              })
            );
          }
        } catch (error) {
          console.error("Failed to fetch DM messages:", error);
        }
      },
    }),
    addMembersToDmGroup: builder.mutation<
      DirectMessageGroup,
      { id: string; addMembersDto: AddMembersDto }
    >({
      query: ({ id, addMembersDto }) => ({
        url: `/${id}/members`,
        method: "POST",
        body: addMembersDto,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "DirectMessageGroup", id },
        "DirectMessageGroup",
      ],
    }),
    leaveDmGroup: builder.mutation<void, string>({
      query: (id) => ({
        url: `/${id}/members/me`,
        method: "DELETE",
      }),
      invalidatesTags: ["DirectMessageGroup"],
    }),
  }),
});

export const {
  useGetUserDmGroupsQuery,
  useCreateDmGroupMutation,
  useGetDmGroupQuery,
  useGetDmMessagesQuery,
  useAddMembersToDmGroupMutation,
  useLeaveDmGroupMutation,
} = directMessagesApi;