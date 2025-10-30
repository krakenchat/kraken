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

export const livekitApi = createApi({
  reducerPath: "livekitApi",
  baseQuery: createAuthedBaseQuery("livekit"),
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
  }),
});

export const { useGenerateTokenMutation, useGenerateDmTokenMutation, useGetConnectionInfoQuery } =
  livekitApi;
