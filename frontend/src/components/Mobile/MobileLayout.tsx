import React from 'react';
import { Box } from '@mui/material';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { VoiceBottomBar } from '../Voice/VoiceBottomBar';
import { MobileNavigationProvider } from './Navigation/MobileNavigationContext';
import { MobileBottomNavigation } from './Navigation/MobileBottomNavigation';
import { MobilePanelContainer } from './Panels/MobilePanelContainer';
import { LAYOUT_CONSTANTS } from '../../utils/breakpoints';

/**
 * Main mobile layout with Discord-style navigation
 * Bottom tabs + swipeable panels
 */
export const MobileLayout: React.FC = () => {
  const { state: voiceState } = useVoiceConnection();

  const hasVoiceBar = voiceState.isConnected;
  const voiceBarOffset = hasVoiceBar ? LAYOUT_CONSTANTS.VOICE_BAR_HEIGHT_MOBILE : 0;

  return (
    <MobileNavigationProvider>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        {/* Panel container - main content area */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <MobilePanelContainer bottomOffset={voiceBarOffset} />
        </Box>

        {/* Voice bar (only shows when in call) */}
        {hasVoiceBar && <VoiceBottomBar />}

        {/* Bottom navigation - always visible */}
        <MobileBottomNavigation />
      </Box>
    </MobileNavigationProvider>
  );
};
