import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Settings, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import axios from 'axios';
import NotificationSettings from '../components/Settings/NotificationSettings';

interface HealthResponse {
  status: string;
  instanceName: string;
  version: string;
  timestamp: string;
}

const SettingsPage: React.FC = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [currentBackendUrl, setCurrentBackendUrl] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBackendUrl, setNewBackendUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Check if running in Electron
    const electronAPI = (window as Window & { electronAPI?: unknown }).electronAPI;
    if (electronAPI) {
      setIsElectron(true);

      // Get current backend URL
      const savedUrl = localStorage.getItem('electron:backendUrl');
      setCurrentBackendUrl(savedUrl);

      // Get app version
      if ((electronAPI as { getAppVersion?: () => Promise<string> }).getAppVersion) {
        (electronAPI as { getAppVersion: () => Promise<string> }).getAppVersion().then(version => {
          setAppVersion(version);
        });
      }

      // Get backend version from last health check
      if (savedUrl) {
        axios.get<HealthResponse>(`${savedUrl}/api/health`)
          .then(response => {
            setBackendVersion(response.data.version);
          })
          .catch(() => {
            // Ignore errors
          });
      }
    }
  }, []);

  const validateBackendUrl = async (url: string): Promise<boolean> => {
    // Strip trailing slashes
    const cleanUrl = url.replace(/\/+$/, '');

    // Validate URL format
    try {
      const urlObj = new URL(cleanUrl);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setValidationError('URL must start with http:// or https://');
        return false;
      }
    } catch {
      setValidationError('Please enter a valid URL (e.g., https://chat.example.com)');
      return false;
    }

    // Test connection to /api/health
    try {
      const response = await axios.get<HealthResponse>(`${cleanUrl}/api/health`, {
        timeout: 10000, // 10 second timeout
      });

      if (response.data && response.data.status === 'ok') {
        const instanceName = response.data.instanceName || 'Unknown Instance';
        setValidationSuccess(`Connected to: ${instanceName}`);
        return true;
      } else {
        setValidationError('Server responded but health check failed');
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          setValidationError('Connection timed out. Please check the URL and try again.');
        } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
          setValidationError(`Cannot connect to ${cleanUrl}. Please check the URL.`);
        } else if (error.response) {
          setValidationError(`Server error: ${error.response.status} ${error.response.statusText}`);
        } else {
          setValidationError(`Failed to connect: ${error.message}`);
        }
      } else {
        setValidationError('An unexpected error occurred');
      }
      return false;
    }
  };

  const handleOpenDialog = () => {
    setNewBackendUrl(currentBackendUrl || '');
    setDialogOpen(true);
    setValidationError(null);
    setValidationSuccess(null);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setNewBackendUrl('');
    setValidationError(null);
    setValidationSuccess(null);
  };

  const handleSaveBackendUrl = async () => {
    if (!newBackendUrl.trim()) {
      setValidationError('Please enter a backend URL');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(null);

    const cleanUrl = newBackendUrl.trim().replace(/\/+$/, '');
    const isValid = await validateBackendUrl(cleanUrl);

    setIsValidating(false);

    if (isValid) {
      // Save to localStorage
      localStorage.setItem('electron:backendUrl', cleanUrl);

      // Reload the app to apply the new configuration
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Settings /> Settings
      </Typography>

      {/* Notification Settings Section */}
      <Box sx={{ mb: 3 }}>
        <NotificationSettings />
      </Box>

      {/* Backend Configuration Section (Electron only) */}
      {isElectron && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Backend Configuration
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Typography variant="body2" color="text.secondary" paragraph>
                Current backend URL:
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace', mb: 2 }}>
                {currentBackendUrl || 'Not configured'}
              </Typography>

              <Button variant="contained" onClick={handleOpenDialog}>
                Change Backend URL
              </Button>

              <Alert severity="warning" sx={{ mt: 2 }}>
                Changing the backend URL will reload the application.
              </Alert>
            </CardContent>
          </Card>

          {/* App Information Section */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                App Information
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    App Version:
                  </Typography>
                  <Typography variant="body2">
                    {appVersion || 'Unknown'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Backend Version:
                  </Typography>
                  <Typography variant="body2">
                    {backendVersion || 'Unknown'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </>
      )}

      {/* Change Backend URL Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Change Backend URL</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Enter the URL of your Kraken backend server. The app will reload after the change.
          </Typography>

          <TextField
            autoFocus
            fullWidth
            label="Backend URL"
            placeholder="https://chat.example.com"
            value={newBackendUrl}
            onChange={(e) => setNewBackendUrl(e.target.value)}
            disabled={isValidating}
            sx={{ mt: 2 }}
            helperText="The URL should not include /api or trailing slashes"
          />

          {validationError && (
            <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
              {validationError}
            </Alert>
          )}

          {validationSuccess && (
            <Alert severity="success" icon={<CheckCircle />} sx={{ mt: 2 }}>
              {validationSuccess}
              <Typography variant="body2" sx={{ mt: 1 }}>
                Reloading app...
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={isValidating}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveBackendUrl}
            variant="contained"
            disabled={isValidating || !newBackendUrl.trim()}
            startIcon={isValidating && <CircularProgress size={20} />}
          >
            {isValidating ? 'Testing...' : 'Save & Reload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsPage;
