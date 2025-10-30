import { createApi } from "@reduxjs/toolkit/query/react";
import type { InstanceInvite } from "../../types/invite.type";
import { createSimpleBaseQuery } from "../createBaseQuery";

export const publicInviteApi = createApi({
  reducerPath: "publicInviteApi",
  baseQuery: createSimpleBaseQuery("invite"),
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