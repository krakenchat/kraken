import React from "react";
import { useQuery } from "@tanstack/react-query";
import { instanceControllerGetPublicSettingsOptions } from "./api-client/@tanstack/react-query.gen";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { useVoiceRecovery } from "./hooks/useVoiceRecovery";
import { MobileLayout } from "./components/Mobile/MobileLayout";
import { TabletLayout } from "./components/Mobile/Tablet/TabletLayout";
import { DesktopLayout } from "./components/Desktop/DesktopLayout";
import { useResponsive } from "./hooks/useResponsive";
import type { User } from "./types/auth.type";
import { useThemeSync } from "./hooks/useThemeSync";
import { useAppBadge } from "./hooks/useAppBadge";
import { usePushResync } from "./hooks/usePushResync";
import { LayoutProviders } from "./components/LayoutProviders";

const Layout: React.FC = () => {
  const { user: userData, isLoading, isError } = useCurrentUser();
  const { data: publicSettings } = useQuery(instanceControllerGetPublicSettingsOptions());
  const instanceName = publicSettings?.name || "Semaphore Chat";
  const { isMobile, isTablet } = useResponsive();

  // Sync theme settings with server (server wins on initial load)
  useThemeSync();

  // Attempt to recover voice connection after page refresh
  // TODO: known double-call on mobile (also invoked in MobileLayout)
  useVoiceRecovery();

  // Document title (with "(N)" unread prefix) + PWA icon badge
  useAppBadge(instanceName);

  // Re-sync a rotated push subscription to the backend on startup (the SW
  // can't authenticate; this is the reliable path).
  usePushResync();

  return (
    <LayoutProviders>
      {isMobile ? (
        <MobileLayout />
      ) : isTablet ? (
        <TabletLayout />
      ) : (
        <DesktopLayout
          instanceName={instanceName}
          isLoading={isLoading}
          isError={isError}
          userData={userData as User | undefined}
        />
      )}
    </LayoutProviders>
  );
};

export default Layout;
