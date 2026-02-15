import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SocketContext } from '../../utils/SocketContext';
import type { MockSocket } from './mockSocket';

interface WrapperOptions {
  queryClient: QueryClient;
  socket?: MockSocket | null;
  isConnected?: boolean;
}

/**
 * Creates a wrapper component for renderHook that provides
 * QueryClientProvider and optionally SocketContext.
 */
export function createTestWrapper({ queryClient, socket = null, isConnected = true }: WrapperOptions) {
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SocketContext.Provider value={{ socket: socket as never, isConnected: socket ? isConnected : false }}>
          {children}
        </SocketContext.Provider>
      </QueryClientProvider>
    );
  };
}
