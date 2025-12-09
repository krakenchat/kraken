import { createApi } from "@reduxjs/toolkit/query/react";
import type { Login, AuthResponse } from "../../types/auth.type";
import { createSimpleBaseQuery, createAuthedBaseQuery } from "../createBaseQuery";

// Session info returned from the API
export interface SessionInfo {
  id: string;
  deviceName: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface RevokeAllResponse {
  message: string;
  revokedCount: number;
}

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: createSimpleBaseQuery("auth"),
  tagTypes: ["Sessions"],
  endpoints: (builder) => ({
    login: builder.query<AuthResponse, Login>({
      query: (body) => ({
        url: "/login",
        method: "POST",
        body,
      }),
    }),
    logout: builder.query({
      query: () => ({
        url: "/logout",
        method: "POST",
      }),
    }),
  }),
});

// Separate API for authenticated session endpoints
export const sessionApi = createApi({
  reducerPath: "sessionApi",
  baseQuery: createAuthedBaseQuery("auth"),
  tagTypes: ["Sessions"],
  endpoints: (builder) => ({
    getSessions: builder.query<SessionInfo[], void>({
      query: () => ({
        url: "/sessions",
        method: "GET",
      }),
      providesTags: ["Sessions"],
    }),
    revokeSession: builder.mutation<{ message: string }, string>({
      query: (sessionId) => ({
        url: `/sessions/${sessionId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Sessions"],
    }),
    revokeAllOtherSessions: builder.mutation<RevokeAllResponse, void>({
      query: () => ({
        url: "/sessions",
        method: "DELETE",
      }),
      invalidatesTags: ["Sessions"],
    }),
  }),
});

export const { useLazyLoginQuery, useLazyLogoutQuery } = authApi;
export const {
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeAllOtherSessionsMutation,
} = sessionApi;
