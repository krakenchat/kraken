/**
 * useNotificationPermission Hook
 *
 * Manages notification permission state and provides methods to request permission.
 * Useful for settings UI and permission prompts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  supportsNotifications,
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '../utils/notifications';

/**
 * Hook for managing notification permission state
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    getNotificationPermission()
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSupported] = useState(supportsNotifications());

  /**
   * Request notification permission from the user
   */
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.warn('[Notifications] Notifications not supported');
      return 'denied' as NotificationPermission;
    }

    if (permission === 'granted') {
      return 'granted' as NotificationPermission;
    }

    setIsRequesting(true);

    try {
      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);
      return newPermission;
    } catch (error) {
      console.error('[Notifications] Error requesting permission:', error);
      return 'denied' as NotificationPermission;
    } finally {
      setIsRequesting(false);
    }
  }, [isSupported, permission]);

  /**
   * Update permission state when it changes externally
   * (e.g., user changes permission in browser settings)
   */
  useEffect(() => {
    if (!isSupported) return;

    const checkPermission = () => {
      const currentPermission = getNotificationPermission();
      if (currentPermission !== permission) {
        setPermission(currentPermission);
      }
    };

    // Check permission periodically
    const interval = setInterval(checkPermission, 5000);

    return () => clearInterval(interval);
  }, [isSupported, permission]);

  /**
   * Listen for permission changes (browser API support is limited)
   */
  // Store permission status and handler in refs to enable proper cleanup
  const permissionStatusRef = useRef<PermissionStatus | null>(null);
  const handleChangeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isSupported || typeof navigator === 'undefined') return;

    // Note: The Permissions API for notifications is not widely supported
    // This is a best-effort attempt to track permission changes
    if ('permissions' in navigator && 'query' in navigator.permissions) {
      const handleChange = () => {
        const newPermission = getNotificationPermission();
        setPermission(newPermission);
      };
      handleChangeRef.current = handleChange;

      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((permissionStatus) => {
          permissionStatusRef.current = permissionStatus;
          permissionStatus.addEventListener('change', handleChange);
        })
        .catch((error) => {
          // Permissions API not supported or query failed
          console.debug('[Notifications] Permissions API not available:', error);
        });

      // Cleanup: remove event listener on unmount
      return () => {
        if (permissionStatusRef.current && handleChangeRef.current) {
          permissionStatusRef.current.removeEventListener('change', handleChangeRef.current);
          permissionStatusRef.current = null;
          handleChangeRef.current = null;
        }
      };
    }
  }, [isSupported]);

  return {
    /**
     * Current notification permission status
     */
    permission,

    /**
     * Whether notifications are supported in this environment
     */
    isSupported,

    /**
     * Whether a permission request is in progress
     */
    isRequesting,

    /**
     * Whether notifications are enabled (permission granted)
     */
    isEnabled: permission === 'granted',

    /**
     * Whether the user has denied notification permission
     */
    isDenied: permission === 'denied',

    /**
     * Whether the user hasn't been asked for permission yet
     */
    isDefault: permission === 'default',

    /**
     * Request notification permission
     */
    requestPermission,
  };
}
