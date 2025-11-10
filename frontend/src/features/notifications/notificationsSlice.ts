/**
 * Notifications Redux Slice
 *
 * Manages local notification state, including unread count and recent notifications.
 * Works with RTK Query API for server sync and WebSocket for real-time updates.
 */

import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import { Notification, NewNotificationPayload } from '../../types/notification.type';

interface NotificationsState {
  /**
   * Recent notifications (for notification center)
   */
  notifications: Notification[];

  /**
   * Unread notification count
   */
  unreadCount: number;

  /**
   * Whether notification permission has been requested
   */
  permissionRequested: boolean;

  /**
   * Notification IDs that have been shown to the user
   */
  shownNotificationIds: string[];
}

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  permissionRequested: false,
  shownNotificationIds: [],
};

const MAX_NOTIFICATIONS = 100;

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /**
     * Set notifications list (from API fetch)
     */
    setNotifications(state, action: PayloadAction<Notification[]>) {
      state.notifications = action.payload.slice(0, MAX_NOTIFICATIONS);
    },

    /**
     * Add a new notification (from WebSocket)
     */
    addNotification(state, action: PayloadAction<NewNotificationPayload>) {
      const payload = action.payload;

      // Convert WebSocket payload to Notification type
      const notification: Notification = {
        id: payload.notificationId,
        userId: '', // Will be set by backend
        type: payload.type,
        messageId: payload.messageId,
        channelId: payload.channelId,
        directMessageGroupId: payload.directMessageGroupId,
        authorId: payload.authorId,
        read: payload.read,
        dismissed: false,
        createdAt: payload.createdAt,
        author: payload.author,
        message: payload.message,
      };

      // Check if notification already exists
      const exists = state.notifications.some((n) => n.id === notification.id);
      if (exists) return;

      // Prepend notification and maintain max limit
      state.notifications = [notification, ...state.notifications].slice(
        0,
        MAX_NOTIFICATIONS
      );

      // Increment unread count if not read
      if (!notification.read) {
        state.unreadCount += 1;
      }
    },

    /**
     * Mark a notification as read
     */
    markNotificationAsRead(state, action: PayloadAction<string>) {
      const notificationId = action.payload;
      const notification = state.notifications.find((n) => n.id === notificationId);

      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },

    /**
     * Mark all notifications as read
     */
    markAllNotificationsAsRead(state) {
      state.notifications.forEach((notification) => {
        notification.read = true;
      });
      state.unreadCount = 0;
    },

    /**
     * Dismiss a notification
     */
    dismissNotification(state, action: PayloadAction<string>) {
      const notificationId = action.payload;
      const notification = state.notifications.find((n) => n.id === notificationId);

      if (notification) {
        notification.dismissed = true;
        if (!notification.read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      }
    },

    /**
     * Remove a notification from the list
     */
    removeNotification(state, action: PayloadAction<string>) {
      const notificationId = action.payload;
      const notification = state.notifications.find((n) => n.id === notificationId);

      if (notification && !notification.read) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }

      state.notifications = state.notifications.filter((n) => n.id !== notificationId);
    },

    /**
     * Set unread count (from API)
     */
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },

    /**
     * Mark that notification permission has been requested
     */
    setPermissionRequested(state, action: PayloadAction<boolean>) {
      state.permissionRequested = action.payload;
    },

    /**
     * Mark a notification as shown (desktop notification displayed)
     */
    markNotificationAsShown(state, action: PayloadAction<string>) {
      if (!state.shownNotificationIds.includes(action.payload)) {
        state.shownNotificationIds.push(action.payload);
      }
    },

    /**
     * Clear all notifications
     */
    clearNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
    },
  },
});

export const {
  setNotifications,
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  removeNotification,
  setUnreadCount,
  setPermissionRequested,
  markNotificationAsShown,
  clearNotifications,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;

/**
 * Selectors
 */

// Select all notifications
export const selectAllNotifications = (state: RootState) =>
  state.notifications.notifications;

// Select unread notifications
export const selectUnreadNotifications = createSelector(
  [selectAllNotifications],
  (notifications) => notifications.filter((n) => !n.read && !n.dismissed)
);

// Select unread count
export const selectUnreadCount = (state: RootState) =>
  state.notifications.unreadCount;

// Select whether permission has been requested
export const selectPermissionRequested = (state: RootState) =>
  state.notifications.permissionRequested;

// Select shown notification IDs
export const selectShownNotificationIds = (state: RootState) =>
  state.notifications.shownNotificationIds;

// Check if a notification has been shown
export const selectIsNotificationShown = (notificationId: string) =>
  createSelector(
    [selectShownNotificationIds],
    (shownIds) => shownIds.includes(notificationId)
  );
