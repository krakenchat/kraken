import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Register, User } from "../../types/auth.type";
import getBaseAuthedQuery, { prepareHeaders } from "../AuthedBaseQuery";
import { getCachedItem, setCachedItem } from "../../utils/storage";

const USER_CACHE_PREFIX = "user_";
const USER_CACHE_TTL = 1000 * 60 * 60; // 1 hour

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
    getUserByIdWithCache: builder.query<User, string>({
      async queryFn(userId, _queryApi, _extraOptions, fetchWithBQ) {
        // 1. Try localStorage cache
        const cached = getCachedItem<User>(`${USER_CACHE_PREFIX}${userId}`);
        if (cached) return { data: cached };
        // 2. Fetch from API
        const result = await fetchWithBQ(`/${userId}`);
        if (result.data) {
          setCachedItem(
            `${USER_CACHE_PREFIX}${userId}`,
            result.data as User,
            USER_CACHE_TTL
          );
          return { data: result.data as User };
        }
        // Only return a valid FetchBaseQueryError or a minimal fallback
        if (result.error) return { error: result.error };
        return { error: { status: 404, data: "User not found" } };
      },
    }),
  }),
});

export const {
  useLazyRegisterQuery,
  useProfileQuery,
  useGetUserByIdWithCacheQuery,
} = usersApi;
