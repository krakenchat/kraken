/**
 * Notifications API Slice
 *
 * RTK Query API slice for notification endpoints.
 * Handles REST API calls for notifications, settings, and channel overrides.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthedBaseQuery } from '../createBaseQuery';
import {
  Notification,
  UserNotificationSettings,
  ChannelNotificationOverride,
  NotificationListResponse,
  NotificationQueryParams,
  UpdateNotificationSettingsDto,
  UpdateChannelOverrideDto,
} from '../../types/notification.type';

export const notificationsApi = createApi({
  reducerPath: 'notificationsApi',
  baseQuery: createAuthedBaseQuery('notifications'),
  tagTypes: ['Notifications', 'NotificationSettings', 'ChannelOverrides'],
  endpoints: (builder) => ({
    /**
     * Get paginated list of notifications
     */
    getNotifications: builder.query<NotificationListResponse, NotificationQueryParams>({
      query: ({ limit = 25, offset = 0, unreadOnly = false }) => ({
        url: `?limit=${limit}&offset=${offset}&unreadOnly=${unreadOnly}`,
        method: 'GET',
      }),
      providesTags: ['Notifications'],
    }),

    /**
     * Get unread notification count
     */
    getUnreadCount: builder.query<{ count: number }, void>({
      query: () => ({
        url: '/unread-count',
        method: 'GET',
      }),
      providesTags: ['Notifications'],
    }),

    /**
     * Mark a notification as read
     */
    markAsRead: builder.mutation<Notification, string>({
      query: (notificationId) => ({
        url: `/${notificationId}/read`,
        method: 'POST',
      }),
      invalidatesTags: ['Notifications'],
    }),

    /**
     * Mark all notifications as read
     */
    markAllAsRead: builder.mutation<{ count: number }, void>({
      query: () => ({
        url: '/read-all',
        method: 'POST',
      }),
      invalidatesTags: ['Notifications'],
    }),

    /**
     * Dismiss a notification
     */
    dismissNotification: builder.mutation<Notification, string>({
      query: (notificationId) => ({
        url: `/${notificationId}/dismiss`,
        method: 'POST',
      }),
      invalidatesTags: ['Notifications'],
    }),

    /**
     * Delete a notification
     */
    deleteNotification: builder.mutation<void, string>({
      query: (notificationId) => ({
        url: `/${notificationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Notifications'],
    }),

    /**
     * Get user notification settings
     */
    getSettings: builder.query<UserNotificationSettings, void>({
      query: () => ({
        url: '/settings',
        method: 'GET',
      }),
      providesTags: ['NotificationSettings'],
    }),

    /**
     * Update user notification settings
     */
    updateSettings: builder.mutation<UserNotificationSettings, UpdateNotificationSettingsDto>({
      query: (settings) => ({
        url: '/settings',
        method: 'PUT',
        body: settings,
      }),
      invalidatesTags: ['NotificationSettings'],
    }),

    /**
     * Get channel notification override
     */
    getChannelOverride: builder.query<ChannelNotificationOverride | null, string>({
      query: (channelId) => ({
        url: `/channels/${channelId}/override`,
        method: 'GET',
      }),
      providesTags: (result, error, channelId) => [
        { type: 'ChannelOverrides', id: channelId },
      ],
    }),

    /**
     * Set or update channel notification override
     */
    setChannelOverride: builder.mutation<
      ChannelNotificationOverride,
      { channelId: string; level: UpdateChannelOverrideDto['level'] }
    >({
      query: ({ channelId, level }) => ({
        url: `/channels/${channelId}/override`,
        method: 'PUT',
        body: { level },
      }),
      invalidatesTags: (result, error, { channelId }) => [
        { type: 'ChannelOverrides', id: channelId },
      ],
    }),

    /**
     * Delete channel notification override
     */
    deleteChannelOverride: builder.mutation<void, string>({
      query: (channelId) => ({
        url: `/channels/${channelId}/override`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, channelId) => [
        { type: 'ChannelOverrides', id: channelId },
      ],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDismissNotificationMutation,
  useDeleteNotificationMutation,
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useGetChannelOverrideQuery,
  useSetChannelOverrideMutation,
  useDeleteChannelOverrideMutation,
} = notificationsApi;
