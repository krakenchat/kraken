import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SocketContext } from '../../utils/SocketContext';
import type { MockSocket } from './mockSocket';

interface WrapperOptions {
  queryClient: QueryClient;
  socket?: MockSocket | null;
}

/**
 * Creates a wrapper component for renderHook that provides
 * QueryClientProvider and optionally SocketContext.
 */
export function createTestWrapper({ queryClient, socket = null }: WrapperOptions) {
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SocketContext.Provider value={socket as never}>
          {children}
        </SocketContext.Provider>
      </QueryClientProvider>
    );
  };
}
