import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";

// Types matching backend DTOs
export interface AliasGroupMember {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AliasGroupSummary {
  id: string;
  name: string;
  communityId: string;
  memberCount: number;
}

export interface AliasGroupWithMembers {
  id: string;
  name: string;
  communityId: string;
  createdAt: string;
  memberCount: number;
  members: AliasGroupMember[];
}

export interface CreateAliasGroupRequest {
  name: string;
  memberIds?: string[];
}

export interface UpdateAliasGroupRequest {
  name: string;
}

export interface AddMemberRequest {
  userId: string;
}

export interface UpdateMembersRequest {
  memberIds: string[];
}

export const aliasGroupsApi = createApi({
  reducerPath: "aliasGroupsApi",
  baseQuery: createAuthedBaseQuery("alias-groups"),
  tagTypes: ["AliasGroup", "AliasGroups"],
  endpoints: (builder) => ({
    // Get all alias groups for a community
    getCommunityAliasGroups: builder.query<AliasGroupSummary[], string>({
      query: (communityId) => ({
        url: `/community/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "AliasGroups", id: communityId },
      ],
    }),

    // Get a single alias group with members
    getAliasGroup: builder.query<AliasGroupWithMembers, string>({
      query: (groupId) => ({
        url: `/${groupId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, groupId) => [
        { type: "AliasGroup", id: groupId },
      ],
    }),

    // Create a new alias group
    createAliasGroup: builder.mutation<
      AliasGroupWithMembers,
      { communityId: string; data: CreateAliasGroupRequest }
    >({
      query: ({ communityId, data }) => ({
        url: `/community/${communityId}`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _error, { communityId }) => [
        { type: "AliasGroups", id: communityId },
      ],
    }),

    // Update alias group name
    updateAliasGroup: builder.mutation<
      AliasGroupWithMembers,
      { groupId: string; data: UpdateAliasGroupRequest }
    >({
      query: ({ groupId, data }) => ({
        url: `/${groupId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "AliasGroup", id: groupId },
        "AliasGroups",
      ],
    }),

    // Delete an alias group
    deleteAliasGroup: builder.mutation<void, { groupId: string; communityId: string }>({
      query: ({ groupId }) => ({
        url: `/${groupId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { groupId, communityId }) => [
        { type: "AliasGroup", id: groupId },
        { type: "AliasGroups", id: communityId },
      ],
    }),

    // Add a member to an alias group
    addAliasGroupMember: builder.mutation<
      void,
      { groupId: string; data: AddMemberRequest }
    >({
      query: ({ groupId, data }) => ({
        url: `/${groupId}/members`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "AliasGroup", id: groupId },
        "AliasGroups",
      ],
    }),

    // Remove a member from an alias group
    removeAliasGroupMember: builder.mutation<
      void,
      { groupId: string; userId: string }
    >({
      query: ({ groupId, userId }) => ({
        url: `/${groupId}/members/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "AliasGroup", id: groupId },
        "AliasGroups",
      ],
    }),

    // Bulk update members of an alias group
    updateAliasGroupMembers: builder.mutation<
      void,
      { groupId: string; data: UpdateMembersRequest }
    >({
      query: ({ groupId, data }) => ({
        url: `/${groupId}/members`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "AliasGroup", id: groupId },
        "AliasGroups",
      ],
    }),
  }),
});

export const {
  useGetCommunityAliasGroupsQuery,
  useGetAliasGroupQuery,
  useCreateAliasGroupMutation,
  useUpdateAliasGroupMutation,
  useDeleteAliasGroupMutation,
  useAddAliasGroupMemberMutation,
  useRemoveAliasGroupMemberMutation,
  useUpdateAliasGroupMembersMutation,
} = aliasGroupsApi;
