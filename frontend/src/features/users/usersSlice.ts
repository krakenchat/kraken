import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Register, User } from "../../types/auth.type";
import getBaseAuthedQuery from "../AuthedBaseQuery";

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/users",
      prepareHeaders: (headers) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        headers.set("Content-Type", "application/json");

        return headers;
      },
    })
  ),
  endpoints: (builder) => ({
    register: builder.query<User, Register>({
      query: (body) => ({
        url: "/",
        method: "POST",
        body,
      }),
    }),
    profile: builder.query<User, void>({
      query: () => ({
        url: "/profile",
        method: "GET",
      }),
    }),
  }),
});

export const { useLazyRegisterQuery, useProfileQuery } = usersApi;
