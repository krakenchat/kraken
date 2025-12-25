/**
 * Push Notifications API Slice
 *
 * RTK Query API slice for push notification endpoints.
 * Handles subscribing/unsubscribing from push notifications.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthedBaseQuery } from '../createBaseQuery';

export interface PushVapidKeyResponse {
  publicKey: string | null;
  enabled: boolean;
}

export interface PushStatusResponse {
  enabled: boolean;
  subscriptionCount: number;
}

export interface PushSubscribeDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export interface PushUnsubscribeDto {
  endpoint: string;
}

export const pushNotificationsApi = createApi({
  reducerPath: 'pushNotificationsApi',
  baseQuery: createAuthedBaseQuery('push'),
  tagTypes: ['PushStatus'],
  endpoints: (builder) => ({
    /**
     * Get VAPID public key for push subscription
     */
    getVapidPublicKey: builder.query<PushVapidKeyResponse, void>({
      query: () => ({
        url: '/vapid-public-key',
        method: 'GET',
      }),
    }),

    /**
     * Get push subscription status for current user
     */
    getPushStatus: builder.query<PushStatusResponse, void>({
      query: () => ({
        url: '/status',
        method: 'GET',
      }),
      providesTags: ['PushStatus'],
    }),

    /**
     * Subscribe to push notifications
     */
    subscribePush: builder.mutation<{ success: boolean; message: string }, PushSubscribeDto>({
      query: (subscription) => ({
        url: '/subscribe',
        method: 'POST',
        body: subscription,
      }),
      invalidatesTags: ['PushStatus'],
    }),

    /**
     * Unsubscribe from push notifications
     */
    unsubscribePush: builder.mutation<{ success: boolean; message: string }, PushUnsubscribeDto>({
      query: (dto) => ({
        url: '/unsubscribe',
        method: 'DELETE',
        body: dto,
      }),
      invalidatesTags: ['PushStatus'],
    }),

    // ========================================================================
    // DEBUG ENDPOINTS (Admin only)
    // ========================================================================

    /**
     * DEBUG: Send a test push notification to current user
     */
    sendTestPush: builder.mutation<
      { success: boolean; sent: number; failed: number; message: string },
      void
    >({
      query: () => ({
        url: '/debug/send-test',
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetVapidPublicKeyQuery,
  useLazyGetVapidPublicKeyQuery,
  useGetPushStatusQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
  // Debug endpoints
  useSendTestPushMutation,
} = pushNotificationsApi;
