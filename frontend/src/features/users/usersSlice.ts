import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Register, User } from "../../types/auth.type";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/users",
      prepareHeaders,
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
