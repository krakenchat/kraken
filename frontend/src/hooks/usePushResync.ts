/**
 * usePushResync
 *
 * Startup re-sync for push subscriptions. This is the *reliable* half of the
 * pushsubscriptionchange story: the SW re-subscribes best-effort but can't
 * authenticate, so on app startup (inside the authenticated tree) we compare
 * the live subscription endpoint against the last endpoint we synced to the
 * backend and re-POST it when the browser has rotated the subscription.
 *
 * Runs once on mount. Cheap and self-limiting: if the subscription is
 * unchanged (the common case) it makes no network call.
 */

import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { logger } from '../utils/logger';
import { pushNotificationsControllerSubscribeMutation } from '../api-client/@tanstack/react-query.gen';
import {
  isPushSupported,
  getCurrentPushSubscription,
  extractSubscriptionData,
} from '../utils/pushSubscription';
import { swDbGet, swDbSet, swDbDelete, SW_DB_KEYS } from '../utils/swDb';
import { shouldResyncPush } from '../utils/pushResync';

export function usePushResync(): void {
  const { mutateAsync: subscribePush } = useMutation(
    pushNotificationsControllerSubscribeMutation(),
  );
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!isPushSupported()) return;

    void (async () => {
      try {
        const subscription = await getCurrentPushSubscription();
        const currentEndpoint = subscription?.endpoint ?? null;
        const lastSynced = await swDbGet<string>(SW_DB_KEYS.lastSyncedEndpoint);

        if (!subscription || !shouldResyncPush(currentEndpoint, lastSynced)) {
          return;
        }

        // The subscription rotated (or was re-created by the SW handler) —
        // re-POST it with a valid JWT and record the new endpoint.
        const subscriptionData = extractSubscriptionData(subscription);
        await subscribePush({ body: subscriptionData });
        await swDbSet(SW_DB_KEYS.lastSyncedEndpoint, subscription.endpoint);
        await swDbDelete(SW_DB_KEYS.pendingEndpoint);
        logger.info('[usePushResync] Re-synced rotated push subscription');
      } catch (err) {
        // Best-effort — a failed re-sync just means the user re-subscribes via
        // the UI if push stops working. Never surface an error to the user.
        logger.warn('[usePushResync] Push re-sync failed:', err);
      }
    })();
  }, [subscribePush]);
}
