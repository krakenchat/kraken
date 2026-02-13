import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  threadsControllerGetMetadataOptions,
  threadsControllerGetMetadataQueryKey,
  threadsControllerSubscribeMutation,
  threadsControllerUnsubscribeMutation,
} from "../api-client/@tanstack/react-query.gen";
import { invalidateByIds, INVALIDATION_GROUPS } from "../utils/queryInvalidation";
import type { ThreadMetadataDto } from "../api-client";
import { logger } from "../utils/logger";

/**
 * Hook wrapping TanStack Query for thread subscription status.
 * Provides optimistic updates for subscribe/unsubscribe.
 */
export function useThreadSubscription(parentMessageId: string) {
  const queryClient = useQueryClient();

  const { data: metadata } = useQuery(
    threadsControllerGetMetadataOptions({
      path: { parentMessageId },
    })
  );

  const isSubscribed = metadata?.isSubscribed ?? false;
  const metadataQueryKey = threadsControllerGetMetadataQueryKey({
    path: { parentMessageId },
  });

  const { mutateAsync: subscribe } = useMutation({
    ...threadsControllerSubscribeMutation(),
    onMutate: () => {
      queryClient.setQueryData(metadataQueryKey, (old: ThreadMetadataDto | undefined) => {
        if (!old) return old;
        return { ...old, isSubscribed: true };
      });
    },
    onError: () => {
      queryClient.setQueryData(metadataQueryKey, (old: ThreadMetadataDto | undefined) => {
        if (!old) return old;
        return { ...old, isSubscribed: false };
      });
    },
    onSettled: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.threadMetadata),
  });

  const { mutateAsync: unsubscribe } = useMutation({
    ...threadsControllerUnsubscribeMutation(),
    onMutate: () => {
      queryClient.setQueryData(metadataQueryKey, (old: ThreadMetadataDto | undefined) => {
        if (!old) return old;
        return { ...old, isSubscribed: false };
      });
    },
    onError: () => {
      queryClient.setQueryData(metadataQueryKey, (old: ThreadMetadataDto | undefined) => {
        if (!old) return old;
        return { ...old, isSubscribed: true };
      });
    },
    onSettled: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.threadMetadata),
  });

  const toggleSubscription = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe({ path: { parentMessageId } });
      } else {
        await subscribe({ path: { parentMessageId } });
      }
    } catch (err) {
      logger.error("Failed to toggle subscription:", err);
    }
  };

  return {
    isSubscribed,
    toggleSubscription,
  };
}
