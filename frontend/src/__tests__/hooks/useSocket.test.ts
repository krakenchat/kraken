import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSocket, useSocketConnected } from '../../hooks/useSocket';
import {
  createTestQueryClient,
  createMockSocket,
  createTestWrapper,
} from '../test-utils';
import type { MockSocket } from '../test-utils';

let queryClient: ReturnType<typeof createTestQueryClient>;
let mockSocket: MockSocket;

beforeEach(() => {
  queryClient = createTestQueryClient();
  mockSocket = createMockSocket();
});

describe('useSocket', () => {
  it('returns the socket from context', () => {
    const { result } = renderHook(() => useSocket(), {
      wrapper: createTestWrapper({ queryClient, socket: mockSocket }),
    });
    expect(result.current).toBe(mockSocket);
  });

  it('returns null when no socket provided', () => {
    const { result } = renderHook(() => useSocket(), {
      wrapper: createTestWrapper({ queryClient, socket: null }),
    });
    expect(result.current).toBeNull();
  });
});

describe('useSocketConnected', () => {
  it('returns true when connected', () => {
    const { result } = renderHook(() => useSocketConnected(), {
      wrapper: createTestWrapper({ queryClient, socket: mockSocket, isConnected: true }),
    });
    expect(result.current).toBe(true);
  });

  it('returns false when disconnected', () => {
    const { result } = renderHook(() => useSocketConnected(), {
      wrapper: createTestWrapper({ queryClient, socket: mockSocket, isConnected: false }),
    });
    expect(result.current).toBe(false);
  });

  it('returns false when no socket', () => {
    const { result } = renderHook(() => useSocketConnected(), {
      wrapper: createTestWrapper({ queryClient, socket: null }),
    });
    expect(result.current).toBe(false);
  });
});
