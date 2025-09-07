import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

export interface CreateMembershipDto {
  userId: string;
  communityId: string;
}

export interface MembershipResponseDto {
  id: string;
  userId: string;
  communityId: string;
  joinedAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export const membershipApi = createApi({
  reducerPath: "membershipApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/membership",
      prepareHeaders,
    })
  ),
  tagTypes: ["Membership"],
  endpoints: (builder) => ({
    // Create membership (add member to community)
    createMembership: builder.mutation<
      MembershipResponseDto,
      CreateMembershipDto
    >({
      query: (body) => ({
        url: "/",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { communityId }) => [
        { type: "Membership", id: `community-${communityId}` },
        "Membership",
      ],
    }),

    // Get all members for a community
    getMembersForCommunity: builder.query<MembershipResponseDto[], string>({
      query: (communityId) => ({
        url: `/community/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "Membership", id: `community-${communityId}` },
      ],
    }),

    // Get memberships for a user
    getMembershipsForUser: builder.query<MembershipResponseDto[], string>({
      query: (userId) => ({
        url: `/user/${userId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, userId) => [
        { type: "Membership", id: `user-${userId}` },
      ],
    }),

    // Get my memberships
    getMyMemberships: builder.query<MembershipResponseDto[], void>({
      query: () => ({
        url: "/my",
        method: "GET",
      }),
      providesTags: [{ type: "Membership", id: "my" }],
    }),

    // Get specific membership
    getMembership: builder.query<
      MembershipResponseDto,
      { userId: string; communityId: string }
    >({
      query: ({ userId, communityId }) => ({
        url: `/community/${communityId}/user/${userId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, { userId, communityId }) => [
        { type: "Membership", id: `${userId}-${communityId}` },
      ],
    }),

    // Remove member from community
    removeMembership: builder.mutation<
      void,
      { userId: string; communityId: string }
    >({
      query: ({ userId, communityId }) => ({
        url: `/community/${communityId}/user/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { userId, communityId }) => [
        { type: "Membership", id: `community-${communityId}` },
        { type: "Membership", id: `user-${userId}` },
        { type: "Membership", id: `${userId}-${communityId}` },
        "Membership",
      ],
    }),

    // Leave community
    leaveCommunity: builder.mutation<void, string>({
      query: (communityId) => ({
        url: `/leave/${communityId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, communityId) => [
        { type: "Membership", id: `community-${communityId}` },
        { type: "Membership", id: "my" },
        "Membership",
      ],
    }),

    // Search community members for mentions
    searchCommunityMembers: builder.query<
      MembershipResponseDto[],
      { communityId: string; query: string; limit?: number }
    >({
      query: ({ communityId, query, limit = 10 }) => ({
        url: `/community/${communityId}/search?query=${encodeURIComponent(query)}&limit=${limit}`,
        method: "GET",
      }),
      providesTags: (_result, _error, { communityId, query }) => [
        { type: "Membership", id: `search-${communityId}-${query}` },
      ],
    }),
  }),
});

export const {
  useCreateMembershipMutation,
  useGetMembersForCommunityQuery,
  useGetMembershipsForUserQuery,
  useGetMyMembershipsQuery,
  useGetMembershipQuery,
  useRemoveMembershipMutation,
  useLeaveCommunityMutation,
  useSearchCommunityMembersQuery,
} = membershipApi;
