import { useQuery } from '@tanstack/react-query';
import { fetchAllMembershipPages } from '../utils/fetchAllMembershipPages';
import { allCommunityMembersQueryKey } from '../utils/membershipQueryKeys';

/**
 * Full community member set, fetched page-by-page via
 * fetchAllMembershipPages. Drop-in replacement for the old
 * `useQuery(membershipControllerFindAllForCommunityOptions(...))` callers
 * that relied on the (previously unpaginated) bare-array response.
 *
 * The query key retains the generated `_id` marker, so existing
 * partial-key invalidation keeps refreshing this cache.
 */
export function useAllCommunityMembers(
  communityId: string,
  options: { enabled?: boolean } = {},
) {
  const enabled = (options.enabled ?? true) && !!communityId;

  return useQuery({
    queryKey: allCommunityMembersQueryKey(communityId),
    queryFn: ({ signal }) => fetchAllMembershipPages(communityId, { signal }),
    enabled,
  });
}
