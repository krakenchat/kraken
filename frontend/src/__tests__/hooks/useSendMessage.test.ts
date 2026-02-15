import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the generated client
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { useSendMessage, SocketNotConnectedError } from '../../hooks/useSendMessage';
import {
  createTestQueryClient,
  createMockSocket,
  createTestWrapper,
  createMessage,
} from '../test-utils';
import type { MockSocket } from '../test-utils';

let queryClient: ReturnType<typeof createTestQueryClient>;
let mockSocket: MockSocket;

beforeEach(() => {
  queryClient = createTestQueryClient();
  mockSocket = createMockSocket();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderSendMessage(
  contextType: 'channel' | 'dm' = 'channel',
  options?: { socket?: MockSocket | null; isConnected?: boolean; callback?: (id: string) => void },
) {
  const socket = options?.socket !== undefined ? options.socket : mockSocket;
  const isConnected = options?.isConnected ?? true;
  return renderHook(() => useSendMessage(contextType, options?.callback), {
    wrapper: createTestWrapper({ queryClient, socket, isConnected }),
  });
}

describe('useSendMessage', () => {
  describe('canSend', () => {
    it('returns true when socket is connected', () => {
      const { result } = renderSendMessage('channel', { isConnected: true });
      expect(result.current.canSend).toBe(true);
    });

    it('returns false when socket is null', () => {
      const { result } = renderSendMessage('channel', { socket: null, isConnected: false });
      expect(result.current.canSend).toBe(false);
    });

    it('returns false when socket is disconnected', () => {
      const { result } = renderSendMessage('channel', { isConnected: false });
      expect(result.current.canSend).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('emits sendMessage event for channel context', async () => {
      const msg = createMessage({ channelId: 'channel-1' });
      const { id: _id, ...payload } = msg;

      const { result } = renderSendMessage('channel');

      await act(async () => {
        result.current.sendMessage(payload);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('sendMessage', payload, expect.any(Function));
    });

    it('emits sendDm event for dm context', async () => {
      const msg = createMessage({ directMessageGroupId: 'dm-1' });
      const { id: _id, ...payload } = msg;

      const { result } = renderSendMessage('dm');

      await act(async () => {
        result.current.sendMessage(payload);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('sendDirectMessage', payload, expect.any(Function));
    });

    it('returns success with messageId on acknowledgment', async () => {
      mockSocket.emit.mockImplementation((_event: string, _payload: unknown, ack: (id: string) => void) => {
        ack('msg-123');
      });

      const { result } = renderSendMessage('channel');
      let sendResult: Awaited<ReturnType<typeof result.current.sendMessage>>;

      await act(async () => {
        sendResult = await result.current.sendMessage(createMessage({ channelId: 'ch-1' }));
      });

      expect(sendResult!.success).toBe(true);
      expect(sendResult!.messageId).toBe('msg-123');
    });

    it('calls callback with messageId on success', async () => {
      const callback = vi.fn();
      mockSocket.emit.mockImplementation((_event: string, _payload: unknown, ack: (id: string) => void) => {
        ack('msg-456');
      });

      const { result } = renderSendMessage('channel', { callback });

      await act(async () => {
        await result.current.sendMessage(createMessage({ channelId: 'ch-1' }));
      });

      expect(callback).toHaveBeenCalledWith('msg-456');
    });

    it('returns error when socket is null', async () => {
      const { result } = renderSendMessage('channel', { socket: null });
      let sendResult: Awaited<ReturnType<typeof result.current.sendMessage>>;

      await act(async () => {
        sendResult = await result.current.sendMessage(createMessage({ channelId: 'ch-1' }));
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.error).toBeInstanceOf(SocketNotConnectedError);
    });

    it('waits for reconnection when socket is disconnected', async () => {
      mockSocket.connected = false;
      mockSocket.emit.mockImplementation((_event: string, _payload: unknown, ack: (id: string) => void) => {
        ack('msg-reconnected');
      });

      const { result } = renderSendMessage('channel', { isConnected: false });
      let sendResult: Awaited<ReturnType<typeof result.current.sendMessage>>;
      let resolvedPromise = false;

      await act(async () => {
        const promise = result.current.sendMessage(createMessage({ channelId: 'ch-1' }));
        promise.then((r) => {
          sendResult = r;
          resolvedPromise = true;
        });

        // Not resolved yet - waiting for reconnection
        expect(resolvedPromise).toBe(false);

        // Simulate reconnection
        await mockSocket.simulateEvent('connect');
      });

      expect(sendResult!.success).toBe(true);
      expect(sendResult!.messageId).toBe('msg-reconnected');
    });

    it('returns error after reconnection timeout', async () => {
      mockSocket.connected = false;
      const { result } = renderSendMessage('channel', { isConnected: false });
      let sendResult: Awaited<ReturnType<typeof result.current.sendMessage>>;

      await act(async () => {
        const promise = result.current.sendMessage(createMessage({ channelId: 'ch-1' }));
        promise.then((r) => { sendResult = r; });

        // Advance past the 5s reconnection timeout
        vi.advanceTimersByTime(5000);
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.error).toBeInstanceOf(SocketNotConnectedError);
    });
  });
});
