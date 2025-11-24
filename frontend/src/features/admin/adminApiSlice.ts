import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";

// Types for instance settings
export interface InstanceSettings {
  id: string;
  name: string;
  description: string | null;
  registrationMode: "OPEN" | "INVITE_ONLY" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInstanceSettingsDto {
  name?: string;
  description?: string;
  registrationMode?: "OPEN" | "INVITE_ONLY" | "CLOSED";
}

export interface InstanceStats {
  totalUsers: number;
  totalCommunities: number;
  totalChannels: number;
  totalMessages: number;
  activeInvites: number;
  bannedUsers: number;
}

// Types for admin user management
export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  verified: boolean;
  role: "OWNER" | "USER";
  createdAt: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  lastSeen: string | null;
  displayName: string | null;
  banned: boolean;
  bannedAt: string | null;
  bannedById: string | null;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  continuationToken?: string;
}

export interface AdminUserFilters {
  limit?: number;
  continuationToken?: string;
  banned?: boolean;
  role?: "OWNER" | "USER";
  search?: string;
}

// Types for admin community management
export interface AdminCommunity {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  banner: string | null;
  createdAt: string;
  memberCount: number;
  channelCount: number;
}

export interface AdminCommunityDetail extends AdminCommunity {
  messageCount: number;
}

export interface AdminCommunityListResponse {
  communities: AdminCommunity[];
  continuationToken?: string;
}

export interface AdminCommunityFilters {
  limit?: number;
  continuationToken?: string;
  search?: string;
}

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: createAuthedBaseQuery(""),
  tagTypes: ["InstanceSettings", "InstanceStats", "AdminUsers", "AdminCommunities"],
  endpoints: (builder) => ({
    // Instance Settings
    getInstanceSettings: builder.query<InstanceSettings, void>({
      query: () => ({
        url: "/instance/settings",
        method: "GET",
      }),
      providesTags: ["InstanceSettings"],
    }),
    updateInstanceSettings: builder.mutation<InstanceSettings, UpdateInstanceSettingsDto>({
      query: (dto) => ({
        url: "/instance/settings",
        method: "PATCH",
        body: dto,
      }),
      invalidatesTags: ["InstanceSettings"],
    }),

    // Instance Stats
    getInstanceStats: builder.query<InstanceStats, void>({
      query: () => ({
        url: "/instance/stats",
        method: "GET",
      }),
      providesTags: ["InstanceStats"],
    }),

    // Admin User Management
    getAdminUsers: builder.query<AdminUserListResponse, AdminUserFilters>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.limit) params.append("limit", filters.limit.toString());
        if (filters.continuationToken) params.append("continuationToken", filters.continuationToken);
        if (filters.banned !== undefined) params.append("banned", filters.banned.toString());
        if (filters.role) params.append("role", filters.role);
        if (filters.search) params.append("search", filters.search);
        return {
          url: `/users/admin/list?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["AdminUsers"],
    }),
    getAdminUser: builder.query<AdminUser, string>({
      query: (id) => ({
        url: `/users/admin/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "AdminUsers", id }],
    }),
    updateUserRole: builder.mutation<AdminUser, { userId: string; role: "OWNER" | "USER" }>({
      query: ({ userId, role }) => ({
        url: `/users/admin/${userId}/role`,
        method: "PATCH",
        body: { role },
      }),
      invalidatesTags: ["AdminUsers", "InstanceStats"],
    }),
    setBanStatus: builder.mutation<AdminUser, { userId: string; banned: boolean }>({
      query: ({ userId, banned }) => ({
        url: `/users/admin/${userId}/ban`,
        method: "PATCH",
        body: { banned },
      }),
      invalidatesTags: ["AdminUsers", "InstanceStats"],
    }),
    deleteUser: builder.mutation<{ success: boolean }, string>({
      query: (userId) => ({
        url: `/users/admin/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AdminUsers", "InstanceStats"],
    }),

    // Admin Community Management
    getAdminCommunities: builder.query<AdminCommunityListResponse, AdminCommunityFilters>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.limit) params.append("limit", filters.limit.toString());
        if (filters.continuationToken) params.append("continuationToken", filters.continuationToken);
        if (filters.search) params.append("search", filters.search);
        return {
          url: `/community/admin/list?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["AdminCommunities"],
    }),
    getAdminCommunity: builder.query<AdminCommunityDetail, string>({
      query: (id) => ({
        url: `/community/admin/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "AdminCommunities", id }],
    }),
    forceDeleteCommunity: builder.mutation<void, string>({
      query: (id) => ({
        url: `/community/admin/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AdminCommunities", "InstanceStats"],
    }),
  }),
});

export const {
  // Instance Settings
  useGetInstanceSettingsQuery,
  useUpdateInstanceSettingsMutation,
  // Instance Stats
  useGetInstanceStatsQuery,
  // Admin User Management
  useGetAdminUsersQuery,
  useGetAdminUserQuery,
  useUpdateUserRoleMutation,
  useSetBanStatusMutation,
  useDeleteUserMutation,
  // Admin Community Management
  useGetAdminCommunitiesQuery,
  useGetAdminCommunityQuery,
  useForceDeleteCommunityMutation,
} = adminApi;
