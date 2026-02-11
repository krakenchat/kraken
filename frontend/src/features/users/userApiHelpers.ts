import { getCachedItem, setCachedItem } from "../../utils/storage";
import type { User } from "../../types/auth.type";
import { queryClient } from "../../main";
import { userControllerGetUserByIdQueryKey } from "../../api-client/@tanstack/react-query.gen";
import { userControllerGetUserById } from "../../api-client/sdk.gen";

const USER_CACHE_PREFIX = "user_";
const USER_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Helper to get user info, using cache, then TanStack Query cache, then API
export async function getUserInfo(userId: string): Promise<User | null> {
  // 1. Try localStorage cache
  const cached = getCachedItem<User>(`${USER_CACHE_PREFIX}${userId}`);
  if (cached) return cached;

  // 2. Try TanStack Query cache
  const queryData = queryClient.getQueryData(
    userControllerGetUserByIdQueryKey({ path: { id: userId } })
  ) as User | undefined;
  if (queryData) {
    setCachedItem(`${USER_CACHE_PREFIX}${userId}`, queryData, USER_CACHE_TTL);
    return queryData;
  }

  // 3. Fetch from API using generated SDK
  try {
    const { data: user } = await userControllerGetUserById({
      path: { id: userId },
      throwOnError: true,
    });
    setCachedItem(`${USER_CACHE_PREFIX}${userId}`, user, USER_CACHE_TTL);
    return user as unknown as User;
  } catch {
    return null;
  }
}
