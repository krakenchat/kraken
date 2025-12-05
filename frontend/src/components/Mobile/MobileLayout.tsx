/**
 * MobileLayout Component
 *
 * Main mobile layout with Discord-style navigation.
 * Uses drawer + screens pattern instead of panel stack.
 *
 * Architecture:
 * - Community drawer (swipe from left edge)
 * - Screen-based navigation (max 2 levels deep)
 * - Bottom navigation tabs
 * - Voice bar when connected
 */

import React from 'react';
import { Box } from '@mui/material';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { VoiceBottomBar } from '../Voice/VoiceBottomBar';
import { AudioRenderer } from '../Voice/AudioRenderer';
import { MobileNavigationProvider } from './Navigation/MobileNavigationContext';
import { MobileBottomNavigation } from './Navigation/MobileBottomNavigation';
import MobileCommunityDrawer from './Navigation/MobileCommunityDrawer';
import { MobileScreenContainer } from './Screens/MobileScreenContainer';
import { LAYOUT_CONSTANTS } from '../../utils/breakpoints';

/**
 * Main mobile layout with Discord-style navigation
 * Drawer + Screens pattern replaces the old panel stack
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
          height: '100dvh', // Use dynamic viewport height for mobile
          width: '100vw',
          overflow: 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          // Safe area padding for notches and gesture bars
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Community drawer - swipe from left edge */}
        <MobileCommunityDrawer />

        {/* Screen container - main content area */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <MobileScreenContainer bottomOffset={voiceBarOffset} />
        </Box>

        {/* Voice bar (only shows when in call) */}
        {hasVoiceBar && <VoiceBottomBar />}

        {/* Audio renderer for remote participants */}
        <AudioRenderer />

        {/* Bottom navigation - always visible */}
        <MobileBottomNavigation />
      </Box>
    </MobileNavigationProvider>
  );
};
