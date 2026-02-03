import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { addServer } from '../../utils/serverStorage';
import { logger } from '../../utils/logger';

interface ConnectionWizardProps {
  open: boolean;
  onComplete: () => void;
}

export const ConnectionWizard: React.FC<ConnectionWizardProps> = ({ open, onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [serverUrl, setServerUrl] = useState('');
  const [serverName, setServerName] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  const steps = ['Welcome', 'Server Details', 'Complete'];

  const validateUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };

  const testConnection = async (url: string): Promise<boolean> => {
    try {
      // Normalize URL
      const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;

      // Test connection to /api/onboarding/status endpoint
      const response = await fetch(`${normalizedUrl}/api/onboarding/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      logger.error('Connection test failed:', error);
      return false;
    }
  };

  const handleNext = async () => {
    setError('');

    if (activeStep === 1) {
      // Validate URL
      if (!serverUrl.trim()) {
        setError('Please enter a server URL');
        return;
      }

      if (!validateUrl(serverUrl)) {
        setError('Please enter a valid URL (http:// or https://)');
        return;
      }

      // Test connection
      setTesting(true);
      const connectionOk = await testConnection(serverUrl);
      setTesting(false);

      if (!connectionOk) {
        setError('Could not connect to server. Please check the URL and try again.');
        return;
      }

      // Auto-generate server name if not provided
      if (!serverName.trim()) {
        try {
          const url = new URL(serverUrl);
          setServerName(url.hostname);
        } catch {
          setServerName('My Server');
        }
      }
    }

    if (activeStep === steps.length - 2) {
      // Save server before going to complete step
      try {
        addServer(serverName || 'My Server', serverUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save server');
        return;
      }
    }

    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setError('');
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleFinish = () => {
    onComplete();
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" gutterBottom>
              Welcome to Kraken!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Let's get you connected to a Kraken server.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You'll need the URL of your Kraken server to continue.
            </Typography>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Enter Server Details
            </Typography>
            <TextField
              fullWidth
              label="Server URL"
              placeholder="https://chat.example.com"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              error={Boolean(error) && !testing}
              helperText={error && !testing ? error : 'Enter the full URL including https://'}
              sx={{ mb: 2 }}
              autoFocus
            />
            <TextField
              fullWidth
              label="Server Name (Optional)"
              placeholder="My Kraken Server"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              helperText="A friendly name to identify this server"
            />
            {testing && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Testing connection...
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" gutterBottom color="success.main">
              ✓ Connected Successfully!
            </Typography>
            <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
              <Typography variant="body2">
                <strong>{serverName || 'Server'}</strong>
                <br />
                {serverUrl}
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary">
              You're all set! Click finish to start using Kraken.
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      onClose={(_, reason) => {
        if (reason !== 'backdropClick') {
          // Allow closing with finish button only
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">Connect to Server</Typography>
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent()}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0 || activeStep === steps.length - 1}
            onClick={handleBack}
          >
            Back
          </Button>
          <Box>
            {activeStep === steps.length - 1 ? (
              <Button variant="contained" onClick={handleFinish}>
                Finish
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={testing}
              >
                {activeStep === steps.length - 2 ? 'Connect' : 'Next'}
              </Button>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
