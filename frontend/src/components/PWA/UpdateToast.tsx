import React, { useState } from 'react';
import { useSyncExternalStore } from 'react';
import { Snackbar, Button } from '@mui/material';
import {
  subscribeSwUpdate,
  shouldShowUpdate,
  applyUpdate,
} from '../../utils/swUpdate';

/**
 * "Update available" toast.
 *
 * With registerType: "prompt", a new service worker installs but waits instead
 * of auto-activating. This toast lets the user apply the update on their terms
 * (calling applyUpdate → updateSW(true) → SKIP_WAITING + reload).
 *
 * It stays hidden while the update is deferred — the voice layer raises the
 * deferral flag during a call (see swUpdate.setUpdateDeferred) so an update
 * never reloads the page mid-call. Once the call ends the toast reappears.
 */
export const UpdateToast: React.FC = () => {
  const show = useSyncExternalStore(subscribeSwUpdate, shouldShowUpdate);
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = () => {
    setIsReloading(true);
    // applyUpdate triggers a reload once the new SW activates; if it rejects
    // we re-enable the button so the user can retry.
    void applyUpdate().catch(() => setIsReloading(false));
  };

  return (
    <Snackbar
      open={show}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      message="Update available"
      action={
        <Button
          color="primary"
          size="small"
          onClick={handleReload}
          disabled={isReloading}
        >
          Reload
        </Button>
      }
    />
  );
};

export default UpdateToast;
