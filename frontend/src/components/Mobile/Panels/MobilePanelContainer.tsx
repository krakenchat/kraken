import React from 'react';
import { Box, Slide } from '@mui/material';
import { useMobileNavigation, type Panel } from '../Navigation/MobileNavigationContext';
import { useSwipeGesture } from '../../../hooks/useSwipeGesture';
import { LAYOUT_CONSTANTS } from '../../../utils/breakpoints';

// Import panel components (we'll create these next)
import { MobileCommunitiesPanel } from './MobileCommunitiesPanel';
import { MobileChannelsPanel } from './MobileChannelsPanel';
import { MobileChatPanel } from './MobileChatPanel';
import { MobileMessagesPanel } from './MobileMessagesPanel';
import { MobileProfilePanel } from './MobileProfilePanel';

interface MobilePanelContainerProps {
  bottomOffset?: number; // For voice bar
}

/**
 * Container that manages the panel stack and handles transitions
 * Implements Discord-style horizontal sliding panels
 */
export const MobilePanelContainer: React.FC<MobilePanelContainerProps> = ({
  bottomOffset = 0,
}) => {
  const { panelStack, popPanel } = useMobileNavigation();

  // Handle swipe right to go back
  const swipeHandlers = useSwipeGesture({
    onSwipeRight: () => {
      if (panelStack.length > 1) {
        popPanel();
      }
    },
    threshold: 50,
  });

  const renderPanel = (panel: Panel | null) => {
    if (!panel) return null;

    switch (panel.type) {
      case 'communities':
        return <MobileCommunitiesPanel />;

      case 'channels':
        return (
          <MobileChannelsPanel communityId={panel.communityId || ''} />
        );

      case 'chat':
        return (
          <MobileChatPanel
            communityId={panel.communityId || ''}
            channelId={panel.channelId || ''}
          />
        );

      case 'messages':
        return <MobileMessagesPanel />;

      case 'dm-chat':
        return <MobileChatPanel dmGroupId={panel.dmGroupId || ''} />;

      case 'profile':
        return <MobileProfilePanel />;

      case 'notifications':
        // TODO: Implement notifications panel
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            Notifications (Coming Soon)
          </Box>
        );

      default:
        return null;
    }
  };

  const totalBottomOffset = LAYOUT_CONSTANTS.BOTTOM_NAV_HEIGHT_MOBILE + bottomOffset;

  return (
    <Box
      {...swipeHandlers}
      sx={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Render panels with slide transitions */}
      {panelStack.map((panel, index) => {
        const isVisible = index === panelStack.length - 1;
        const direction = 'left'; // Slide in from right

        return (
          <Slide
            key={`${panel.type}-${panel.communityId || ''}-${panel.channelId || ''}-${panel.dmGroupId || ''}-${index}`}
            direction={direction}
            in={isVisible}
            mountOnEnter
            unmountOnExit
            timeout={300}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'background.default',
                zIndex: index,
                overflow: 'auto',
                pb: `${totalBottomOffset}px`,
              }}
            >
              {renderPanel(panel)}
            </Box>
          </Slide>
        );
      })}
    </Box>
  );
};
