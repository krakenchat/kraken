import React from "react";
import { ReplayBufferProvider } from "../contexts/ReplayBufferContext";
import { SocketHubProvider } from "../socket-hub";
import { IncomingCallProvider } from "../contexts/IncomingCallContext";
import { IncomingCallListener } from "./DirectMessage/IncomingCallListener";
import { IncomingCallBanner } from "./DirectMessage/IncomingCallBanner";
import { useNotificationSideEffects } from "../hooks/useNotificationSideEffects";
import { useVoicePresenceSounds } from "../hooks/useVoicePresenceSounds";

/** Inner component that uses hooks requiring SocketHubProvider context */
const LayoutHooksBridge: React.FC = () => {
  // Notification side effects (sounds, desktop notifications, Electron click)
  useNotificationSideEffects({
    showDesktopNotifications: true,
    playSound: true,
  });

  // Voice presence sounds (other users joining/leaving your channel)
  useVoicePresenceSounds();

  return null;
};

/**
 * Provider stack shared by all three Layout branches (mobile/tablet/desktop):
 * ReplayBufferProvider > SocketHubProvider > IncomingCallProvider, plus the
 * hooks/UI that need to live inside that provider tree.
 */
export const LayoutProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ReplayBufferProvider>
    <SocketHubProvider>
      <IncomingCallProvider>
        <LayoutHooksBridge />
        <IncomingCallListener />
        <IncomingCallBanner />
        {children}
      </IncomingCallProvider>
    </SocketHubProvider>
  </ReplayBufferProvider>
);

export default LayoutProviders;
