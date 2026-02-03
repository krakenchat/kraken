import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import { OnboardingData } from './OnboardingWizard';
import { useSetupInstanceMutation } from '../../features/onboarding/onboardingApiSlice';
import { useLazyLoginQuery } from '../../features/auth/authSlice';
import { logger } from '../../utils/logger';

interface CompletionStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onComplete: () => void;
}

const CompletionStep: React.FC<CompletionStepProps> = ({
  data,
  onBack,
  onComplete,
}) => {
  const [setupInstance, { isLoading, error }] = useSetupInstanceMutation();
  const [login] = useLazyLoginQuery();
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSetup = async () => {
    try {
      const result = await setupInstance({
        adminUsername: data.adminUsername,
        adminPassword: data.adminPassword,
        adminEmail: data.adminEmail || undefined,
        instanceName: data.instanceName,
        instanceDescription: data.instanceDescription || undefined,
        defaultCommunityName: data.defaultCommunityName || undefined,
        createDefaultCommunity: data.createDefaultCommunity,
        setupToken: data.setupToken,
      }).unwrap();

      if (result.success) {
        setIsCompleted(true);
        
        // Automatically login with the admin credentials
        try {
          const response = await login({
            username: data.adminUsername,
            password: data.adminPassword
          }).unwrap();

          // Store the tokens
          localStorage.setItem('accessToken', JSON.stringify(response.accessToken));
          if (response.refreshToken) {
            localStorage.setItem('refreshToken', response.refreshToken);
          }
          
          // Give user a moment to see the success message, then redirect
          setTimeout(() => {
            onComplete();
          }, 2000);
        } catch (loginError) {
          logger.error('Auto-login failed:', loginError);
          // Still complete but redirect to login page
          setTimeout(() => {
            onComplete();
          }, 2000);
        }
      }
    } catch (err) {
      logger.error('Setup failed:', err);
    }
  };

  if (isCompleted) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          🎉 Setup Complete!
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Your Kraken instance is ready to use. Logging you in automatically...
        </Typography>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Ready to Launch! 🚀
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Review your configuration and complete the setup.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Configuration Summary:
          </Typography>
          
          <List>
            <ListItem>
              <ListItemIcon>
                <PersonIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Admin Account" 
                secondary={`Username: ${data.adminUsername}${data.adminEmail ? ` • Email: ${data.adminEmail}` : ''}`}
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <BusinessIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Instance Configuration" 
                secondary={`Name: ${data.instanceName}${data.instanceDescription ? ` • ${data.instanceDescription}` : ''}`}
              />
            </ListItem>
            
            {data.createDefaultCommunity && (
              <ListItem>
                <ListItemIcon>
                  <GroupsIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Default Community" 
                  secondary={`"${data.defaultCommunityName}" with #general, #announcements, and voice-chat channels`}
                />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <strong>Setup failed:</strong> {
            'data' in error && error.data && typeof error.data === 'object' && 'message' in error.data
              ? String(error.data.message)
              : 'An unexpected error occurred. Please try again.'
          }
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>What happens next:</strong>
        <br />
        • Your admin account will be created with full permissions
        <br />
        • An invite code will be generated for adding more users
        <br />
        • You'll be redirected to login with your new credentials
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button onClick={onBack} variant="outlined" disabled={isLoading}>
          Back
        </Button>
        <Button 
          onClick={handleSetup} 
          variant="contained" 
          size="large"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
        >
          {isLoading ? 'Setting up...' : 'Complete Setup'}
        </Button>
      </Box>
    </Box>
  );
};

export default CompletionStep;