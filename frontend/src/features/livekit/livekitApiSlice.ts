import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

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
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/livekit",
      prepareHeaders,
    })
  ),
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
