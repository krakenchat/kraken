import { createApi } from "@reduxjs/toolkit/query/react";
import { createAuthedBaseQuery } from "../createBaseQuery";

export interface CreateTokenRequest {
  roomId: string;
  identity?: string;
  name?: string;
  ttl?: number;
}

export interface TokenResponse {
  token: string;
}

export interface ConnectionInfo {
  url: string;
}

export interface StartReplayBufferRequest {
  channelId: string;
  roomName: string;
  videoTrackId: string;
  audioTrackId: string;
  /** Participant identity for querying track resolution to match egress encoding */
  participantIdentity?: string;
}

export interface ReplayBufferResponse {
  sessionId: string;
  egressId: string;
  status: string;
}

export interface CaptureReplayRequest {
  durationMinutes?: 1 | 2 | 5 | 10;
  startSeconds?: number;
  endSeconds?: number;
  destination: 'library' | 'channel' | 'dm';
  targetChannelId?: string;
  targetDirectMessageGroupId?: string;
}

export interface CaptureReplayResponse {
  clipId: string;
  fileId: string;
  durationSeconds: number;
  requestedDurationSeconds: number;
  sizeBytes: number;
  downloadUrl: string;
  messageId?: string;
}

export interface ClipResponse {
  id: string;
  fileId: string;
  channelId: string | null;
  durationSeconds: number;
  isPublic: boolean;
  capturedAt: string;
  downloadUrl: string;
  sizeBytes: number;
  filename: string;
}

export interface UpdateClipRequest {
  isPublic?: boolean;
}

export interface ShareClipRequest {
  destination: 'channel' | 'dm';
  targetChannelId?: string;
  targetDirectMessageGroupId?: string;
}

export interface ShareClipResponse {
  messageId: string;
  clipId: string;
  destination: 'channel' | 'dm';
}

export interface SessionInfoResponse {
  hasActiveSession: boolean;
  sessionId?: string;
  totalSegments?: number;
  totalDurationSeconds?: number;
  bufferStartTime?: string;
  bufferEndTime?: string;
}

export const livekitApi = createApi({
  reducerPath: "livekitApi",
  baseQuery: createAuthedBaseQuery("livekit"),
  tagTypes: ['Clips'],
  endpoints: (builder) => ({
    generateToken: builder.mutation<TokenResponse, CreateTokenRequest>({
      query: (body) => ({
        url: "/token",
        method: "POST",
        body,
      }),
    }),
    generateDmToken: builder.mutation<TokenResponse, CreateTokenRequest>({
      query: (body) => ({
        url: "/dm-token",
        method: "POST",
        body,
      }),
    }),
    getConnectionInfo: builder.query<ConnectionInfo, void>({
      query: () => ({
        url: "/connection-info",
        method: "GET",
      }),
    }),
    startReplayBuffer: builder.mutation<ReplayBufferResponse, StartReplayBufferRequest>({
      query: (body) => ({
        url: "/replay/start",
        method: "POST",
        body,
      }),
    }),
    stopReplayBuffer: builder.mutation<ReplayBufferResponse, void>({
      query: () => ({
        url: "/replay/stop",
        method: "POST",
      }),
    }),
    captureReplay: builder.mutation<CaptureReplayResponse, CaptureReplayRequest>({
      query: (body) => ({
        url: "/replay/capture",
        method: "POST",
        body,
      }),
      invalidatesTags: ['Clips'],
    }),
    // Clip Library endpoints
    getMyClips: builder.query<ClipResponse[], void>({
      query: () => "/clips",
      providesTags: ['Clips'],
    }),
    getUserPublicClips: builder.query<ClipResponse[], string>({
      query: (userId) => `/clips/user/${userId}`,
    }),
    updateClip: builder.mutation<ClipResponse, { clipId: string; data: UpdateClipRequest }>({
      query: ({ clipId, data }) => ({
        url: `/clips/${clipId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ['Clips'],
    }),
    deleteClip: builder.mutation<{ success: boolean }, string>({
      query: (clipId) => ({
        url: `/clips/${clipId}`,
        method: "DELETE",
      }),
      invalidatesTags: ['Clips'],
    }),
    shareClip: builder.mutation<ShareClipResponse, { clipId: string; data: ShareClipRequest }>({
      query: ({ clipId, data }) => ({
        url: `/clips/${clipId}/share`,
        method: "POST",
        body: data,
      }),
    }),
    // Session info for custom trimming
    getSessionInfo: builder.query<SessionInfoResponse, void>({
      query: () => "/replay/session-info",
    }),
  }),
});

export const {
  useGenerateTokenMutation,
  useGenerateDmTokenMutation,
  useGetConnectionInfoQuery,
  useStartReplayBufferMutation,
  useStopReplayBufferMutation,
  useCaptureReplayMutation,
  useGetMyClipsQuery,
  useGetUserPublicClipsQuery,
  useUpdateClipMutation,
  useDeleteClipMutation,
  useShareClipMutation,
  useGetSessionInfoQuery,
} = livekitApi;
