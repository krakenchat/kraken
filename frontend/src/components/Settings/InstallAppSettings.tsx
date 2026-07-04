import React, { useState } from 'react';
import { Card, CardContent, Typography, Divider, Button, Box } from '@mui/material';
import InstallDesktopIcon from '@mui/icons-material/InstallDesktop';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { logger } from '../../utils/logger';

/**
 * "Install app" section for the settings page. Rendered only when the
 * browser has offered an install prompt (Chromium) and the app isn't
 * already installed or running in Electron.
 */
const InstallAppSettings: React.FC = () => {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [isPrompting, setIsPrompting] = useState(false);

  if (!canInstall) {
    return null;
  }

  const handleInstall = async () => {
    setIsPrompting(true);
    try {
      const outcome = await promptInstall();
      logger.info('[PWA] Install prompt outcome:', outcome);
    } finally {
      setIsPrompting(false);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Install App
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary" paragraph>
          Install Semaphore Chat on this device for faster access, its own
          window, and better notification support.
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<InstallDesktopIcon />}
            onClick={handleInstall}
            disabled={isPrompting}
          >
            Install app
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default InstallAppSettings;
