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
  defaultStorageQuotaBytes: number;
  maxFileSizeBytes: number;
}

export interface UpdateInstanceSettingsDto {
  name?: string;
  description?: string;
  registrationMode?: "OPEN" | "INVITE_ONLY" | "CLOSED";
  defaultStorageQuotaBytes?: number;
  maxFileSizeBytes?: number;
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

// Types for storage management
export interface UserStorageStats {
  userId: string;
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
  fileCount: number;
}

export interface StorageDistribution {
  under25Percent: number;
  under50Percent: number;
  under75Percent: number;
  under90Percent: number;
  over90Percent: number;
}

export interface StorageByType {
  type: string;
  bytes: number;
  count: number;
}

export interface ServerStats {
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryFreeBytes: number;
  memoryUsedPercent: number;
  cpuCores: number;
  cpuModel: string;
  loadAverage: number[];
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskFreeBytes: number;
  diskUsedPercent: number;
  platform: string;
  hostname: string;
  uptime: number;
}

export interface InstanceStorageStats {
  totalStorageUsedBytes: number;
  totalFileCount: number;
  totalUserCount: number;
  averageStoragePerUserBytes: number;
  userStorageDistribution: StorageDistribution;
  storageByType: StorageByType[];
  defaultQuotaBytes: number;
  maxFileSizeBytes: number;
  usersApproachingQuota: number;
  usersOverQuota: number;
  server: ServerStats;
}

export interface UsersStorageListResponse {
  users: UserStorageStats[];
  total: number;
}

export interface UsersStorageFilters {
  skip?: number;
  take?: number;
  minPercentUsed?: number;
}

// Types for instance role management
export interface InstanceRole {
  id: string;
  name: string;
  actions: string[];
  createdAt: string;
}

export interface InstanceRoleUser {
  userId: string;
  username: string;
  displayName?: string;
}

export interface CreateInstanceRoleDto {
  name: string;
  actions: string[];
}

export interface UpdateInstanceRoleDto {
  name?: string;
  actions?: string[];
}

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: createAuthedBaseQuery(""),
  tagTypes: ["InstanceSettings", "InstanceStats", "AdminUsers", "AdminCommunities", "StorageStats", "UserStorage", "InstanceRoles", "InstanceRoleUsers"],
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

    // Storage Management
    getInstanceStorageStats: builder.query<InstanceStorageStats, void>({
      query: () => ({
        url: "/storage/instance",
        method: "GET",
      }),
      providesTags: ["StorageStats"],
    }),
    getUsersStorageList: builder.query<UsersStorageListResponse, UsersStorageFilters>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.skip !== undefined) params.append("skip", filters.skip.toString());
        if (filters.take !== undefined) params.append("take", filters.take.toString());
        if (filters.minPercentUsed !== undefined) params.append("minPercentUsed", filters.minPercentUsed.toString());
        return {
          url: `/storage/users?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["UserStorage"],
    }),
    getUserStorageStats: builder.query<UserStorageStats, string>({
      query: (userId) => ({
        url: `/storage/users/${userId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, userId) => [{ type: "UserStorage", id: userId }],
    }),
    updateUserQuota: builder.mutation<UserStorageStats, { userId: string; quotaBytes: number }>({
      query: ({ userId, quotaBytes }) => ({
        url: `/storage/users/${userId}/quota`,
        method: "PATCH",
        body: { quotaBytes },
      }),
      invalidatesTags: ["UserStorage", "StorageStats"],
    }),
    recalculateUserStorage: builder.mutation<UserStorageStats, string>({
      query: (userId) => ({
        url: `/storage/users/${userId}/recalculate`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, userId) => [{ type: "UserStorage", id: userId }],
    }),
    getMyStorageStats: builder.query<UserStorageStats, void>({
      query: () => ({
        url: "/storage/my-usage",
        method: "GET",
      }),
      providesTags: ["UserStorage"],
    }),

    // Instance Role Management
    getInstanceRoles: builder.query<InstanceRole[], void>({
      query: () => ({
        url: "/roles/instance/all",
        method: "GET",
      }),
      providesTags: ["InstanceRoles"],
    }),
    createInstanceRole: builder.mutation<InstanceRole, CreateInstanceRoleDto>({
      query: (dto) => ({
        url: "/roles/instance",
        method: "POST",
        body: dto,
      }),
      invalidatesTags: ["InstanceRoles"],
    }),
    updateInstanceRole: builder.mutation<InstanceRole, { roleId: string; data: UpdateInstanceRoleDto }>({
      query: ({ roleId, data }) => ({
        url: `/roles/instance/${roleId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["InstanceRoles"],
    }),
    deleteInstanceRole: builder.mutation<void, string>({
      query: (roleId) => ({
        url: `/roles/instance/${roleId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["InstanceRoles"],
    }),
    assignInstanceRole: builder.mutation<void, { roleId: string; userId: string }>({
      query: ({ roleId, userId }) => ({
        url: `/roles/instance/${roleId}/assign`,
        method: "POST",
        body: { userId },
      }),
      invalidatesTags: ["InstanceRoles", "InstanceRoleUsers", "AdminUsers"],
    }),
    removeInstanceRole: builder.mutation<void, { roleId: string; userId: string }>({
      query: ({ roleId, userId }) => ({
        url: `/roles/instance/${roleId}/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["InstanceRoles", "InstanceRoleUsers", "AdminUsers"],
    }),
    getInstanceRoleUsers: builder.query<InstanceRoleUser[], string>({
      query: (roleId) => ({
        url: `/roles/instance/${roleId}/users`,
        method: "GET",
      }),
      providesTags: (_result, _error, roleId) => [{ type: "InstanceRoleUsers", id: roleId }],
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
  // Storage Management
  useGetInstanceStorageStatsQuery,
  useGetUsersStorageListQuery,
  useGetUserStorageStatsQuery,
  useUpdateUserQuotaMutation,
  useRecalculateUserStorageMutation,
  useGetMyStorageStatsQuery,
  // Instance Role Management
  useGetInstanceRolesQuery,
  useCreateInstanceRoleMutation,
  useUpdateInstanceRoleMutation,
  useDeleteInstanceRoleMutation,
  useAssignInstanceRoleMutation,
  useRemoveInstanceRoleMutation,
  useGetInstanceRoleUsersQuery,
} = adminApi;
