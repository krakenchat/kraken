import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { InstanceInvite } from "../../types/invite.type";

export const publicInviteApi = createApi({
  reducerPath: "publicInviteApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/invite",
  }),
  endpoints: (builder) => ({
    getPublicInviteByCode: builder.query<InstanceInvite | null, string>({
      query: (code) => ({
        url: `/public/${code}`,
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetPublicInviteByCodeQuery,
} = publicInviteApi;