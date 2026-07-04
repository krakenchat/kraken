import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsControllerGetUnreadCountOptions } from '../api-client/@tanstack/react-query.gen';

/**
 * Mirrors the unread notification count onto:
 *  - the installed PWA's icon via the Badging API (Android home screen /
 *    desktop taskbar; Chromium-only, feature-detected), and
 *  - the document title as a "(N) " prefix for browser-tab users.
 *
 * The unread-count query cache is kept live by the socket-hub notification
 * handlers, so this re-renders on every unread change without polling.
 */
export function useAppBadge(baseTitle: string): void {
  const { data } = useQuery(notificationsControllerGetUnreadCountOptions());
  const unreadCount = data?.count ?? 0;

  // PWA icon badge
  useEffect(() => {
    if (!('setAppBadge' in navigator)) {
      return;
    }
    const nav = navigator as Navigator & {
      setAppBadge: (count?: number) => Promise<void>;
      clearAppBadge: () => Promise<void>;
    };
    if (unreadCount > 0) {
      nav.setAppBadge(unreadCount).catch(() => {});
    } else {
      nav.clearAppBadge().catch(() => {});
    }
  }, [unreadCount]);

  // Tab title unread prefix
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
  }, [unreadCount, baseTitle]);
}
