import { getCachedItem, setCachedItem } from "../../utils/storage";
import type { User } from "../../types/auth.type";
import { store } from "../../app/store";
import { usersApi } from "./usersSlice";
import { getApiUrl } from "../../config/env";

const USER_CACHE_PREFIX = "user_";
const USER_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Helper to get user info, using cache, then RTK query if needed
export async function getUserInfo(userId: string): Promise<User | null> {
  // 1. Try localStorage cache
  const cached = getCachedItem<User>(`${USER_CACHE_PREFIX}${userId}`);
  if (cached) return cached;

  // 2. Try RTK Query cache (if a getUserById endpoint exists)
  const state = store.getState();
  const usersCache = state[usersApi.reducerPath]?.queries || {};
  for (const key in usersCache) {
    const entry = usersCache[key];
    const data = entry?.data as User | undefined;
    if (
      data &&
      typeof data === "object" &&
      "id" in data &&
      data.id === userId
    ) {
      setCachedItem(`${USER_CACHE_PREFIX}${userId}`, data, USER_CACHE_TTL);
      return data;
    }
  }

  // 3. Fetch from API (by id)
  try {
    // If you have a getUserById endpoint, use it here:
    // const result = await store.dispatch(usersApi.endpoints.getUserById.initiate(userId)).unwrap();
    // setCachedItem(`${USER_CACHE_PREFIX}${userId}`, result, USER_CACHE_TTL);
    // return result;

    // Fallback: direct fetch
    const response = await fetch(getApiUrl(`/users/${userId}`), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    });
    if (response.ok) {
      const user: User = await response.json();
      setCachedItem(`${USER_CACHE_PREFIX}${userId}`, user, USER_CACHE_TTL);
      return user;
    }
  } catch {
    /* ignore */
  }

  return null;
}
