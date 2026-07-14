import { membershipControllerFindAllForCommunity } from '../api-client/sdk.gen';
import type { MembershipResponseDto } from '../api-client/types.gen';
import type { Client } from '../api-client/client';
import {
  FULL_MEMBER_LIST_PAGE_SIZE,
  FULL_MEMBER_LIST_MAX_PAGES,
} from './membershipQueryKeys';

export interface FetchAllMembershipPagesOptions {
  /** Members per page (server caps at 500). */
  limit?: number;
  /** Safety valve: stop after this many pages even if more remain. */
  maxPages?: number;
  /** Optional client override (defaults to the generated singleton). */
  client?: Client;
  signal?: AbortSignal;
}

/**
 * Fetch every page of a community's member list and return the flattened
 * array. Used by consumers that genuinely need the full set today (mention
 * autocomplete, member management, alias-group editing, private-channel
 * membership). Server-side member search is the intended long-term
 * replacement for these full-set fetches — tracked as a follow-up.
 *
 * The maxPages cap bounds worst-case work for pathologically large
 * communities (default 4 pages x 500 = 2000 members).
 */
export async function fetchAllMembershipPages(
  communityId: string,
  options: FetchAllMembershipPagesOptions = {},
): Promise<MembershipResponseDto[]> {
  const {
    limit = FULL_MEMBER_LIST_PAGE_SIZE,
    maxPages = FULL_MEMBER_LIST_MAX_PAGES,
    client,
    signal,
  } = options;

  const members: MembershipResponseDto[] = [];
  let continuationToken = '';

  for (let page = 0; page < maxPages; page++) {
    const { data } = await membershipControllerFindAllForCommunity({
      path: { communityId },
      query: { limit, continuationToken },
      ...(client ? { client } : {}),
      signal,
      throwOnError: true,
    });
    members.push(...data.members);
    if (!data.continuationToken) break;
    continuationToken = data.continuationToken;
  }

  return members;
}
