import React from 'react';
import { useTrackSubscription, TrackSubscriptionContext } from '../../hooks/useTrackSubscription';

/**
 * Provides track subscription actions (watch/stop-watching camera & screen share)
 * to the component tree. Renders alongside AudioRenderer in the layout.
 */
export const TrackSubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const actions = useTrackSubscription();

  return (
    <TrackSubscriptionContext.Provider value={actions}>
      {children}
    </TrackSubscriptionContext.Provider>
  );
};
