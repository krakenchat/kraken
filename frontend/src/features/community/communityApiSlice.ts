import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Community } from "../../types/community.type";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

export const communityApi = createApi({
  reducerPath: "communityApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/community",
      prepareHeaders,
    })
  ),
  endpoints: (builder) => ({
    myCommunities: builder.query<Community[], void>({
      query: () => ({
        url: "/mine",
        method: "GET",
      }),
    }),
    getCommunityById: builder.query<Community, string>({
      query: (communityId) => ({
        url: `/${communityId}`,
        method: "GET",
      }),
    }),
  }),
});

export const { useMyCommunitiesQuery, useGetCommunityByIdQuery } = communityApi;
