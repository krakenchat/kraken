import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Login, AuthResponse } from "../../types/auth.type";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/auth" }),
  endpoints: (builder) => ({
    login: builder.query<string, Login>({
      query: (body) => ({
        url: "/login",
        method: "POST",
        body,
      }),
      transformResponse: (response: AuthResponse) => response.accessToken,
    }),
    logout: builder.query({
      query: () => ({
        url: "/logout",
        method: "POST",
      }),
    }),
  }),
});

export const { useLazyLoginQuery, useLazyLogoutQuery } = authApi;
