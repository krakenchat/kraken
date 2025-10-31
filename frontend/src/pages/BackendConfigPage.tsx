import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import axios from 'axios';

interface HealthResponse {
  status: string;
  instanceName: string;
  version: string;
  timestamp: string;
}

const BackendConfigPage: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);

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

  const handleTestConnection = async () => {
    if (!backendUrl.trim()) {
      setValidationError('Please enter a backend URL');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(null);

    const cleanUrl = backendUrl.trim().replace(/\/+$/, '');
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
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Configure Backend
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Enter the URL of your Kraken backend server. This should be the base URL where your
            backend is hosted (e.g., https://chat.yourdomain.com).
          </Typography>

          <TextField
            fullWidth
            label="Backend URL"
            placeholder="https://chat.example.com"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            disabled={isValidating}
            sx={{ mb: 2 }}
            helperText="The URL should not include /api or trailing slashes"
          />

          {validationError && (
            <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
              {validationError}
            </Alert>
          )}

          {validationSuccess && (
            <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
              {validationSuccess}
              <Typography variant="body2" sx={{ mt: 1 }}>
                Reloading app...
              </Typography>
            </Alert>
          )}

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleTestConnection}
            disabled={isValidating || !backendUrl.trim()}
            startIcon={isValidating && <CircularProgress size={20} />}
          >
            {isValidating ? 'Testing Connection...' : 'Connect'}
          </Button>

          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Note:</strong> You can change this URL later in the settings page.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BackendConfigPage;
