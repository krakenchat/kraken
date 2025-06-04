import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Community } from "../../types/community.type";
import type { CreateCommunity } from "../../types/create-community.type";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

// Add UpdateCommunity type for the update mutation
type UpdateCommunity = Partial<Omit<CreateCommunity, "id">>;

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
      providesTags: ["Community"],
    }),
    getCommunityById: builder.query<Community, string>({
      query: (communityId) => ({
        url: `/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "Community", id: communityId },
      ],
    }),
    createCommunity: builder.mutation<Community, CreateCommunity>({
      query: (createCommunityDto) => ({
        url: "/",
        method: "POST",
        body: createCommunityDto,
      }),
      invalidatesTags: ["Community"],
    }),
    updateCommunity: builder.mutation<
      Community,
      { id: string; data: UpdateCommunity }
    >({
      query: ({ id, data }) => ({
        url: `/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Community", id },
        "Community",
      ],
    }),
  }),
  tagTypes: ["Community"],
});

export const {
  useMyCommunitiesQuery,
  useGetCommunityByIdQuery,
  useCreateCommunityMutation,
  useUpdateCommunityMutation,
} = communityApi;
