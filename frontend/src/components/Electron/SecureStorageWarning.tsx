/**
 * Secure Storage Warning
 *
 * Subscribes to tokenService's one-time "secure storage unavailable"
 * warning and surfaces it via the app's existing snackbar/notification
 * mechanism (NotificationContext). Renders nothing itself.
 *
 * Mounted inside AuthGate's <NotificationProvider> so it's available
 * whenever the user is in the authenticated app shell — where the refresh
 * token gets (re-)persisted on login and on every periodic token refresh.
 */

import { useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { onSecureStorageWarning } from '../../utils/tokenService';

export const SecureStorageWarning = () => {
  const { showNotification } = useNotification();

  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;

    return onSecureStorageWarning(() => {
      showNotification(
        'Secure credential storage is unavailable on this system; your session token will be stored unencrypted.',
        'warning'
      );
    });
  }, [showNotification]);

  return null;
};

export default SecureStorageWarning;
