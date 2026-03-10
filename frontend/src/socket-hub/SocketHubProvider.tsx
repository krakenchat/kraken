import React, { useMemo } from 'react';
import { createEventBus } from './emitter';
import { SocketHubContext } from './SocketHubContext';
import { useSocketHub } from './useSocketHub';
import { useActivityDetector } from '../hooks/useActivityDetector';

export function SocketHubProvider({ children }: { children: React.ReactNode }) {
  const eventBus = useMemo(() => createEventBus(), []);

  useActivityDetector();
  useSocketHub(eventBus);

  return (
    <SocketHubContext.Provider value={eventBus}>
      {children}
    </SocketHubContext.Provider>
  );
}
