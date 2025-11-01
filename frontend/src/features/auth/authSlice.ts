import { createApi } from "@reduxjs/toolkit/query/react";
import type { Login, AuthResponse } from "../../types/auth.type";
import { createSimpleBaseQuery } from "../createBaseQuery";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: createSimpleBaseQuery("auth"),
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

export const { useLazyLoginQuery, useLazyLogoutQuery } = authApi;
