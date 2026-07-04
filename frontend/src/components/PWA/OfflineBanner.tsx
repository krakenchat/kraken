import React, { useEffect, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';

/**
 * Slim "You're offline" indicator.
 *
 * Listens to the browser's online/offline events and shows a snackbar while
 * the network is unreachable. It disappears automatically when connectivity
 * returns. Purely presentational — the app shell itself is served offline by
 * the service worker's navigation fallback.
 */
export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false,
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Snackbar
      open={isOffline}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity="warning"
        icon={<WifiOffIcon fontSize="inherit" />}
        variant="filled"
        sx={{ width: '100%' }}
      >
        You're offline
      </Alert>
    </Snackbar>
  );
};

export default OfflineBanner;
