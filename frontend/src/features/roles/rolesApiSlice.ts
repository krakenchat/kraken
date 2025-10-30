import { createApi } from "@reduxjs/toolkit/query/react";
import type { UserRoles } from "../../types/roles.type";
import { createAuthedBaseQuery } from "../createBaseQuery";

export interface RoleDto {
  id: string;
  name: string;
  actions: string[];
  createdAt: string;
}

export interface CommunityRoles {
  communityId: string;
  roles: RoleDto[];
}

export interface CreateRoleRequest {
  name: string;
  actions: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  actions?: string[];
}

export interface AssignRoleRequest {
  userId: string;
  roleId: string;
}

export interface RoleUser {
  userId: string;
  username: string;
  displayName?: string;
}

export const rolesApi = createApi({
  reducerPath: "rolesApi",
  baseQuery: createAuthedBaseQuery("roles"),
  endpoints: (builder) => ({
    // Get my roles for a community
    getMyRolesForCommunity: builder.query<UserRoles, string>({
      query: (communityId) => ({
        url: `/my/community/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "UserRoles", id: `my-community-${communityId}` },
      ],
    }),

    // Get my roles for a channel
    getMyRolesForChannel: builder.query<UserRoles, string>({
      query: (channelId) => ({
        url: `/my/channel/${channelId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, channelId) => [
        { type: "UserRoles", id: `my-channel-${channelId}` },
      ],
    }),

    // Get my instance roles
    getMyInstanceRoles: builder.query<UserRoles, void>({
      query: () => ({
        url: "/my/instance",
        method: "GET",
      }),
      providesTags: [{ type: "UserRoles", id: "my-instance" }],
    }),

    // Get another user's roles for a community
    getUserRolesForCommunity: builder.query<
      UserRoles,
      { userId: string; communityId: string }
    >({
      query: ({ userId, communityId }) => ({
        url: `/user/${userId}/community/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, { userId, communityId }) => [
        { type: "UserRoles", id: `${userId}-community-${communityId}` },
      ],
    }),

    // Get another user's roles for a channel
    getUserRolesForChannel: builder.query<
      UserRoles,
      { userId: string; channelId: string }
    >({
      query: ({ userId, channelId }) => ({
        url: `/user/${userId}/channel/${channelId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, { userId, channelId }) => [
        { type: "UserRoles", id: `${userId}-channel-${channelId}` },
      ],
    }),

    // Get another user's instance roles
    getUserInstanceRoles: builder.query<UserRoles, string>({
      query: (userId) => ({
        url: `/user/${userId}/instance`,
        method: "GET",
      }),
      providesTags: (_result, _error, userId) => [
        { type: "UserRoles", id: `${userId}-instance` },
      ],
    }),

    // ===== ROLE MANAGEMENT ENDPOINTS =====

    // Get all roles for a community
    getCommunityRoles: builder.query<CommunityRoles, string>({
      query: (communityId) => ({
        url: `/community/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "CommunityRoles", id: communityId },
      ],
    }),

    // Create a new role in a community
    createCommunityRole: builder.mutation<
      RoleDto,
      { communityId: string; data: CreateRoleRequest }
    >({
      query: ({ communityId, data }) => ({
        url: `/community/${communityId}`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _error, { communityId }) => [
        { type: "CommunityRoles", id: communityId },
      ],
    }),

    // Update a role
    updateRole: builder.mutation<RoleDto, { roleId: string; data: UpdateRoleRequest }>({
      query: ({ roleId, data }) => ({
        url: `/${roleId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["CommunityRoles"],
    }),

    // Delete a role
    deleteRole: builder.mutation<void, string>({
      query: (roleId) => ({
        url: `/${roleId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["CommunityRoles"],
    }),

    // ===== USER-ROLE ASSIGNMENT ENDPOINTS =====

    // Assign role to user
    assignRoleToUser: builder.mutation<
      void,
      { communityId: string; data: AssignRoleRequest }
    >({
      query: ({ communityId, data }) => ({
        url: `/community/${communityId}/assign`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _error, { communityId, data }) => [
        { type: "UserRoles", id: `${data.userId}-community-${communityId}` },
        { type: "CommunityRoles", id: communityId },
      ],
    }),

    // Remove role from user
    removeRoleFromUser: builder.mutation<
      void,
      { communityId: string; userId: string; roleId: string }
    >({
      query: ({ communityId, userId, roleId }) => ({
        url: `/community/${communityId}/users/${userId}/roles/${roleId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { communityId, userId }) => [
        { type: "UserRoles", id: `${userId}-community-${communityId}` },
        { type: "CommunityRoles", id: communityId },
      ],
    }),

    // Get users assigned to a role
    getUsersForRole: builder.query<
      RoleUser[],
      { roleId: string; communityId?: string }
    >({
      query: ({ roleId, communityId }) => ({
        url: `/${roleId}/users${communityId ? `?communityId=${communityId}` : ""}`,
        method: "GET",
      }),
      providesTags: (_result, _error, { roleId }) => [
        { type: "RoleUsers", id: roleId },
      ],
    }),
  }),
  tagTypes: ["UserRoles", "CommunityRoles", "RoleUsers"],
});

export const {
  useGetMyRolesForCommunityQuery,
  useGetMyRolesForChannelQuery,
  useGetMyInstanceRolesQuery,
  useGetUserRolesForCommunityQuery,
  useGetUserRolesForChannelQuery,
  useGetUserInstanceRolesQuery,
  // Role management hooks
  useGetCommunityRolesQuery,
  useCreateCommunityRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  // User-role assignment hooks
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useGetUsersForRoleQuery,
} = rolesApi;
