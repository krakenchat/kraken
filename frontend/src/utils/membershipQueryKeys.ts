import { membershipControllerFindAllForCommunityQueryKey } from '../api-client/@tanstack/react-query.gen';

/** Members per page for the infinite community member list (MemberListContainer). */
export const MEMBER_LIST_PAGE_SIZE = 100;

/**
 * No `maxPages` cap for the infinite member list on purpose: in TanStack v5
 * `maxPages` is a sliding-window CACHE bound (fetching page N+1 evicts page
 * 1), which would silently drop already-rendered members from the list —
 * defeating the "Show more" pagination UX. Memory is bounded instead by the
 * 100/page size and user-driven "Show more" pacing.
 */

/** Page size used by fetchAllMembershipPages (server max). */
export const FULL_MEMBER_LIST_PAGE_SIZE = 500;

/** Max pages fetched by fetchAllMembershipPages (500 * 4 = 2000 members). */
export const FULL_MEMBER_LIST_MAX_PAGES = 4;

/**
 * Stable query key for the infinite community members query. Fixes the
 * `query` portion of the key (limit + a placeholder continuationToken) so
 * the cache key doesn't change across pages — matching the pattern used by
 * `channelMessagesQueryKey` for message pagination. Per-page continuation
 * tokens are handled internally by React Query via `pageParam`.
 *
 * Both this key and `allCommunityMembersQueryKey` keep the generated
 * `_id: 'membershipControllerFindAllForCommunity'` marker, so the existing
 * partial-key invalidation (`[{ _id: ... }]`) in queryInvalidation.ts and
 * roleHandlers.ts matches them unchanged.
 */
export function communityMembersQueryKey(communityId: string) {
  return membershipControllerFindAllForCommunityQueryKey({
    path: { communityId },
    query: { limit: MEMBER_LIST_PAGE_SIZE, continuationToken: '' },
  });
}

/**
 * Query key for consumers that need the full member set (via
 * fetchAllMembershipPages). Distinct from `communityMembersQueryKey` (the
 * query.limit differs), so the flat array cached here never collides with
 * the InfiniteData cached by MemberListContainer.
 */
export function allCommunityMembersQueryKey(communityId: string) {
  return membershipControllerFindAllForCommunityQueryKey({
    path: { communityId },
    query: { limit: FULL_MEMBER_LIST_PAGE_SIZE, continuationToken: '' },
  });
}
