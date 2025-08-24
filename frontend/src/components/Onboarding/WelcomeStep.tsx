import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon,
  Chat as ChatIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { OnboardingData } from './OnboardingWizard';

interface WelcomeStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom>
        🎉 Welcome to Your New Kraken Instance!
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
        Kraken is a powerful, self-hosted communication platform that gives you complete 
        control over your team's chat experience. Let's get you set up in just a few minutes.
      </Typography>

      <Card sx={{ mb: 4, textAlign: 'left' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            What you'll get:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <ChatIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Real-time messaging" 
                secondary="Instant chat with channels, direct messages, and voice/video calls"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <PeopleIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Community management" 
                secondary="Organize your team with communities, roles, and permissions"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <SecurityIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Complete privacy" 
                secondary="Your data stays on your servers - no third-party access"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <SpeedIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Lightning fast" 
                secondary="Built with modern technology for optimal performance"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        This setup wizard will guide you through creating your admin account, 
        configuring your instance, and setting up your first community.
      </Typography>

      <Button 
        variant="contained" 
        size="large" 
        onClick={onNext}
        startIcon={<CheckCircleIcon />}
      >
        Let's Get Started
      </Button>
    </Box>
  );
};

export default WelcomeStep;