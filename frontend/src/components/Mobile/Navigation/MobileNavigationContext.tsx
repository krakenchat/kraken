/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';

// Bottom tab options
export type MobileTab = 'communities' | 'messages' | 'notifications' | 'profile';

// Panel types that can be in the stack
export type PanelType =
  | 'communities'
  | 'channels'
  | 'chat'
  | 'messages'
  | 'dm-chat'
  | 'profile'
  | 'notifications';

export interface Panel {
  type: PanelType;
  // Optional context data for the panel
  communityId?: string;
  channelId?: string;
  dmGroupId?: string;
}

interface MobileNavigationContextType {
  // Current active bottom tab
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;

  // Panel stack (e.g., [communities, channels, chat])
  panelStack: Panel[];

  // Navigate to a new panel (pushes onto stack)
  pushPanel: (panel: Panel) => void;

  // Go back (pops from stack)
  popPanel: () => void;

  // Clear stack and start fresh
  clearPanels: () => void;

  // Replace entire stack (useful for tab switches)
  setPanelStack: (panels: Panel[]) => void;

  // Get the currently visible panel
  getCurrentPanel: () => Panel | null;
}

const MobileNavigationContext = createContext<MobileNavigationContextType | undefined>(
  undefined
);

export const MobileNavigationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeTab, setActiveTabState] = useState<MobileTab>('communities');
  const [panelStack, setPanelStack] = useState<Panel[]>([{ type: 'communities' }]);

  const pushPanel = useCallback((panel: Panel) => {
    setPanelStack((prev) => [...prev, panel]);
  }, []);

  const popPanel = useCallback(() => {
    setPanelStack((prev) => {
      if (prev.length <= 1) {
        // Don't pop if only one panel (base level)
        return prev;
      }
      return prev.slice(0, -1);
    });
  }, []);

  const clearPanels = useCallback(() => {
    setPanelStack([]);
  }, []);

  const getCurrentPanel = useCallback((): Panel | null => {
    if (panelStack.length === 0) return null;
    return panelStack[panelStack.length - 1];
  }, [panelStack]);

  // When tab changes, reset panel stack appropriately
  const setActiveTab = useCallback((tab: MobileTab) => {
    setActiveTabState(tab);

    // Set default panel for each tab
    switch (tab) {
      case 'communities':
        setPanelStack([{ type: 'communities' }]);
        break;
      case 'messages':
        setPanelStack([{ type: 'messages' }]);
        break;
      case 'notifications':
        setPanelStack([{ type: 'notifications' }]);
        break;
      case 'profile':
        setPanelStack([{ type: 'profile' }]);
        break;
    }
  }, []);

  const value: MobileNavigationContextType = {
    activeTab,
    setActiveTab,
    panelStack,
    pushPanel,
    popPanel,
    clearPanels,
    setPanelStack,
    getCurrentPanel,
  };

  return (
    <MobileNavigationContext.Provider value={value}>
      {children}
    </MobileNavigationContext.Provider>
  );
};

export const useMobileNavigation = () => {
  const context = useContext(MobileNavigationContext);
  if (context === undefined) {
    throw new Error('useMobileNavigation must be used within MobileNavigationProvider');
  }
  return context;
};
