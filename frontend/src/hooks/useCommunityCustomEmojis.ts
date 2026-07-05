import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { customEmojiControllerListCommunityEmojisOptions } from "../api-client/@tanstack/react-query.gen";
import type { CustomEmojiDto } from "../api-client/types.gen";

export interface CommunityCustomEmojis {
  emojis: CustomEmojiDto[];
  /** Lookup by emoji id (for rendering spans / reaction sentinels). */
  byId: Map<string, CustomEmojiDto>;
  /** Lookup by shortcode name (for parsing `:name:` in the composer). */
  byName: Map<string, CustomEmojiDto>;
  isLoading: boolean;
}

/**
 * Fetch a community's custom emojis (cached via TanStack Query). Disabled for
 * DMs / when no community is in context, in which case empty maps are returned.
 */
export function useCommunityCustomEmojis(
  communityId?: string | null,
): CommunityCustomEmojis {
  const { data, isLoading } = useQuery({
    ...customEmojiControllerListCommunityEmojisOptions({
      path: { communityId: communityId || "" },
    }),
    enabled: !!communityId,
  });

  return useMemo(() => {
    const emojis = data ?? [];
    const byId = new Map<string, CustomEmojiDto>();
    const byName = new Map<string, CustomEmojiDto>();
    for (const emoji of emojis) {
      byId.set(emoji.id, emoji);
      byName.set(emoji.name, emoji);
    }
    return { emojis, byId, byName, isLoading };
  }, [data, isLoading]);
}
