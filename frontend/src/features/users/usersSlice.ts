import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Register, User } from "../../types/auth.type";

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/users" }),
  endpoints: (builder) => ({
    register: builder.query<User, Register>({
      query: (body) => ({
        url: "/",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const { useLazyRegisterQuery } = usersApi;
