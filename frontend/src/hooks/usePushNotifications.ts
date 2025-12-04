/**
 * usePushNotifications Hook
 *
 * Manages push notification subscription state and provides
 * methods to subscribe/unsubscribe from push notifications.
 *
 * This hook is only relevant for web PWA - Electron uses native notifications.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  useGetVapidPublicKeyQuery,
  useGetPushStatusQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
} from '../features/push-notifications/pushNotificationsApiSlice';
import {
  isPushSupported,
  hasNotificationPermission,
  requestNotificationPermission,
  getCurrentPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  extractSubscriptionData,
} from '../utils/pushSubscription';

export interface UsePushNotificationsResult {
  /** Whether push notifications are supported in this environment */
  isSupported: boolean;
  /** Whether push is enabled on the server (VAPID keys configured) */
  isServerEnabled: boolean;
  /** Whether the user is currently subscribed to push notifications */
  isSubscribed: boolean;
  /** Whether notification permission has been granted */
  hasPermission: boolean;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Subscribe to push notifications */
  subscribe: () => Promise<boolean>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  /** Toggle subscription state */
  toggle: () => Promise<boolean>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query VAPID public key and push status from backend
  const { data: vapidData, isLoading: isLoadingVapid } = useGetVapidPublicKeyQuery(undefined, {
    skip: !isPushSupported(),
  });
  const { data: pushStatus, isLoading: isLoadingStatus, refetch: refetchStatus } = useGetPushStatusQuery(undefined, {
    skip: !isPushSupported(),
  });

  // Mutations for subscribing/unsubscribing
  const [subscribePushMutation] = useSubscribePushMutation();
  const [unsubscribePushMutation] = useUnsubscribePushMutation();

  const isSupported = isPushSupported();
  const isServerEnabled = vapidData?.enabled ?? false;
  const hasPermission = hasNotificationPermission();

  // Check if we have a local subscription on mount
  useEffect(() => {
    if (!isSupported) return;

    getCurrentPushSubscription().then((subscription) => {
      setIsSubscribed(subscription !== null);
    });
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Push notifications are not supported in this browser');
      return false;
    }

    if (!isServerEnabled || !vapidData?.publicKey) {
      setError('Push notifications are not configured on this instance');
      return false;
    }

    setIsLoading(true);
    setError(null);

    let subscription: PushSubscription | null = null;

    try {
      // Request permission if needed
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        setError('Notification permission was denied');
        return false;
      }

      // Subscribe via Push API
      subscription = await subscribeToPush(vapidData.publicKey);

      // Extract data and send to backend
      const subscriptionData = extractSubscriptionData(subscription);
      await subscribePushMutation(subscriptionData).unwrap();

      setIsSubscribed(true);
      refetchStatus();
      return true;
    } catch (err) {
      // If we created a local subscription but backend failed, clean it up
      if (subscription) {
        try {
          await subscription.unsubscribe();
        } catch (cleanupErr) {
          console.warn('[usePushNotifications] Failed to cleanup local subscription:', cleanupErr);
        }
      }

      const message = err instanceof Error ? err.message : 'Failed to subscribe to push notifications';
      setError(message);
      console.error('[usePushNotifications] Subscribe error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isServerEnabled, vapidData?.publicKey, subscribePushMutation, refetchStatus]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return true;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current subscription
      const subscription = await getCurrentPushSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return true;
      }

      // Unsubscribe from backend first
      try {
        await unsubscribePushMutation({ endpoint: subscription.endpoint }).unwrap();
      } catch (backendError) {
        // Continue even if backend fails - we'll clean up the local subscription
        console.warn('[usePushNotifications] Backend unsubscribe failed:', backendError);
      }

      // Unsubscribe locally
      await unsubscribeFromPush();

      setIsSubscribed(false);
      refetchStatus();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unsubscribe from push notifications';
      setError(message);
      console.error('[usePushNotifications] Unsubscribe error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, unsubscribePushMutation, refetchStatus]);

  // Toggle subscription state
  const toggle = useCallback(async (): Promise<boolean> => {
    if (isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [isSubscribed, subscribe, unsubscribe]);

  return {
    isSupported,
    isServerEnabled,
    isSubscribed,
    hasPermission,
    isLoading: isLoading || isLoadingVapid || isLoadingStatus,
    error,
    subscribe,
    unsubscribe,
    toggle,
  };
}
