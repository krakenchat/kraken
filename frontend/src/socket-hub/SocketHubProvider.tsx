import React, { useMemo } from 'react';
import { createEventBus } from './emitter';
import { SocketHubContext } from './SocketHubContext';
import { useSocketHub } from './useSocketHub';

function SocketHubInner({ children }: { children: React.ReactNode }) {
  const eventBus = useMemo(() => createEventBus(), []);

  useSocketHub(eventBus);

  return (
    <SocketHubContext.Provider value={eventBus}>
      {children}
    </SocketHubContext.Provider>
  );
}

export function SocketHubProvider({ children }: { children: React.ReactNode }) {
  return <SocketHubInner>{children}</SocketHubInner>;
}
