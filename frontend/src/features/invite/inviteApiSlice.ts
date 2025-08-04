import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { InstanceInvite, CreateInviteDto } from "../../types/invite.type";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

export const inviteApi = createApi({
  reducerPath: "inviteApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/invite",
      prepareHeaders,
    })
  ),
  endpoints: (builder) => ({
    getInvites: builder.query<InstanceInvite[], void>({
      query: () => ({
        url: "/",
        method: "GET",
      }),
      providesTags: ["Invite"],
    }),
    getInviteByCode: builder.query<InstanceInvite | null, string>({
      query: (code) => ({
        url: `/${code}`,
        method: "GET",
      }),
      providesTags: (_result, _error, code) => [
        { type: "Invite", id: code },
      ],
    }),
    createInvite: builder.mutation<InstanceInvite, CreateInviteDto>({
      query: (createInviteDto) => ({
        url: "/",
        method: "POST",
        body: createInviteDto,
      }),
      invalidatesTags: ["Invite"],
    }),
    deleteInvite: builder.mutation<void, string>({
      query: (code) => ({
        url: `/${code}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, code) => [
        { type: "Invite", id: code },
        "Invite",
      ],
    }),
  }),
  tagTypes: ["Invite"],
});

export const {
  useGetInvitesQuery,
  useGetInviteByCodeQuery,
  useCreateInviteMutation,
  useDeleteInviteMutation,
} = inviteApi;