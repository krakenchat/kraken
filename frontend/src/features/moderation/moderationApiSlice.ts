import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";

// =========================================
// TYPES
// =========================================

export type ModerationAction =
  | "BAN_USER"
  | "UNBAN_USER"
  | "KICK_USER"
  | "TIMEOUT_USER"
  | "REMOVE_TIMEOUT"
  | "DELETE_MESSAGE"
  | "PIN_MESSAGE"
  | "UNPIN_MESSAGE";

export interface CommunityBan {
  id: string;
  communityId: string;
  userId: string;
  moderatorId: string;
  reason: string | null;
  createdAt: string;
  expiresAt: string | null;
  active: boolean;
}

export interface CommunityTimeout {
  id: string;
  communityId: string;
  userId: string;
  moderatorId: string;
  reason: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface ModerationLog {
  id: string;
  communityId: string;
  moderatorId: string;
  targetUserId: string | null;
  targetMessageId: string | null;
  action: ModerationAction;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PinnedMessage {
  id: string;
  content: string;
  authorId: string;
  channelId: string;
  pinned: boolean;
  pinnedAt: string | null;
  pinnedBy: string | null;
  createdAt: string;
  author?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface TimeoutStatus {
  isTimedOut: boolean;
  expiresAt: string | null;
}

export interface ModerationLogsResponse {
  logs: ModerationLog[];
  total: number;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
}

// =========================================
// DTO TYPES
// =========================================

export interface BanUserDto {
  reason?: string;
  expiresAt?: string; // ISO date string
}

export interface UnbanUserDto {
  reason?: string;
}

export interface KickUserDto {
  reason?: string;
}

export interface TimeoutUserDto {
  durationSeconds: number;
  reason?: string;
}

export interface RemoveTimeoutDto {
  reason?: string;
}

export interface PinMessageDto {
  reason?: string;
}

export interface UnpinMessageDto {
  reason?: string;
}

export interface DeleteMessageAsModDto {
  reason?: string;
}

export interface GetModerationLogsParams {
  communityId: string;
  limit?: number;
  offset?: number;
  action?: ModerationAction;
}

// =========================================
// API SLICE
// =========================================

export const moderationApi = createApi({
  reducerPath: "moderationApi",
  baseQuery: createAuthedBaseQuery("moderation"),
  tagTypes: ["BanList", "TimeoutList", "ModerationLogs", "PinnedMessages"],
  endpoints: (builder) => ({
    // =========================================
    // BAN ENDPOINTS
    // =========================================

    banUser: builder.mutation<
      SuccessResponse,
      { communityId: string; userId: string; dto: BanUserDto }
    >({
      query: ({ communityId, userId, dto }) => ({
        url: `/ban/${communityId}/${userId}`,
        method: "POST",
        body: dto,
      }),
      invalidatesTags: (_result, _error, { communityId }) => [
        { type: "BanList", id: communityId },
        { type: "ModerationLogs", id: communityId },
      ],
    }),

    unbanUser: builder.mutation<
      SuccessResponse,
      { communityId: string; userId: string; dto?: UnbanUserDto }
    >({
      query: ({ communityId, userId, dto }) => ({
        url: `/ban/${communityId}/${userId}`,
        method: "DELETE",
        body: dto || {},
      }),
      invalidatesTags: (_result, _error, { communityId }) => [
        { type: "BanList", id: communityId },
        { type: "ModerationLogs", id: communityId },
      ],
    }),

    getBanList: builder.query<CommunityBan[], string>({
      query: (communityId) => ({
        url: `/bans/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "BanList", id: communityId },
      ],
    }),

    // =========================================
    // KICK ENDPOINT
    // =========================================

    kickUser: builder.mutation<
      SuccessResponse,
      { communityId: string; userId: string; dto?: KickUserDto }
    >({
      query: ({ communityId, userId, dto }) => ({
        url: `/kick/${communityId}/${userId}`,
        method: "POST",
        body: dto || {},
      }),
      invalidatesTags: (_result, _error, { communityId }) => [
        { type: "ModerationLogs", id: communityId },
      ],
    }),

    // =========================================
    // TIMEOUT ENDPOINTS
    // =========================================

    timeoutUser: builder.mutation<
      SuccessResponse,
      { communityId: string; userId: string; dto: TimeoutUserDto }
    >({
      query: ({ communityId, userId, dto }) => ({
        url: `/timeout/${communityId}/${userId}`,
        method: "POST",
        body: dto,
      }),
      invalidatesTags: (_result, _error, { communityId }) => [
        { type: "TimeoutList", id: communityId },
        { type: "ModerationLogs", id: communityId },
      ],
    }),

    removeTimeout: builder.mutation<
      SuccessResponse,
      { communityId: string; userId: string; dto?: RemoveTimeoutDto }
    >({
      query: ({ communityId, userId, dto }) => ({
        url: `/timeout/${communityId}/${userId}`,
        method: "DELETE",
        body: dto || {},
      }),
      invalidatesTags: (_result, _error, { communityId }) => [
        { type: "TimeoutList", id: communityId },
        { type: "ModerationLogs", id: communityId },
      ],
    }),

    getTimeoutList: builder.query<CommunityTimeout[], string>({
      query: (communityId) => ({
        url: `/timeouts/${communityId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, communityId) => [
        { type: "TimeoutList", id: communityId },
      ],
    }),

    getTimeoutStatus: builder.query<
      TimeoutStatus,
      { communityId: string; userId: string }
    >({
      query: ({ communityId, userId }) => ({
        url: `/timeout-status/${communityId}/${userId}`,
        method: "GET",
      }),
    }),

    // =========================================
    // MESSAGE PINNING ENDPOINTS
    // =========================================

    pinMessage: builder.mutation<
      SuccessResponse,
      { messageId: string; dto?: PinMessageDto }
    >({
      query: ({ messageId, dto }) => ({
        url: `/pin/${messageId}`,
        method: "POST",
        body: dto || {},
      }),
      invalidatesTags: ["PinnedMessages"],
    }),

    unpinMessage: builder.mutation<
      SuccessResponse,
      { messageId: string; dto?: UnpinMessageDto }
    >({
      query: ({ messageId, dto }) => ({
        url: `/pin/${messageId}`,
        method: "DELETE",
        body: dto || {},
      }),
      invalidatesTags: ["PinnedMessages"],
    }),

    getPinnedMessages: builder.query<PinnedMessage[], string>({
      query: (channelId) => ({
        url: `/pins/${channelId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, channelId) => [
        { type: "PinnedMessages", id: channelId },
      ],
    }),

    // =========================================
    // MESSAGE DELETION ENDPOINT
    // =========================================

    deleteMessageAsMod: builder.mutation<
      SuccessResponse,
      { messageId: string; dto?: DeleteMessageAsModDto }
    >({
      query: ({ messageId, dto }) => ({
        url: `/message/${messageId}`,
        method: "DELETE",
        body: dto || {},
      }),
      // Moderation logs will be updated, but message list is managed by messages API
      invalidatesTags: ["ModerationLogs"],
    }),

    // =========================================
    // MODERATION LOGS ENDPOINT
    // =========================================

    getModerationLogs: builder.query<
      ModerationLogsResponse,
      GetModerationLogsParams
    >({
      query: ({ communityId, limit, offset, action }) => {
        const params = new URLSearchParams();
        if (limit) params.append("limit", limit.toString());
        if (offset) params.append("offset", offset.toString());
        if (action) params.append("action", action);
        const queryString = params.toString();
        return {
          url: `/logs/${communityId}${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (_result, _error, { communityId }) => [
        { type: "ModerationLogs", id: communityId },
      ],
    }),
  }),
});

export const {
  // Ban endpoints
  useBanUserMutation,
  useUnbanUserMutation,
  useGetBanListQuery,
  // Kick endpoint
  useKickUserMutation,
  // Timeout endpoints
  useTimeoutUserMutation,
  useRemoveTimeoutMutation,
  useGetTimeoutListQuery,
  useGetTimeoutStatusQuery,
  // Pin endpoints
  usePinMessageMutation,
  useUnpinMessageMutation,
  useGetPinnedMessagesQuery,
  // Delete message endpoint
  useDeleteMessageAsModMutation,
  // Logs endpoint
  useGetModerationLogsQuery,
} = moderationApi;
