import { useRef, useCallback, useEffect } from 'react';
import { ClientEvents } from '@kraken/shared';
import { useSocket } from './useSocket';

interface UseTypingEmitterOptions {
  channelId?: string;
  directMessageGroupId?: string;
}

const TYPING_DEBOUNCE_MS = 3_000;
const TYPING_IDLE_MS = 5_000;

/**
 * Emits typing start/stop events. Call `handleKeyPress` on input change
 * and `sendTypingStop` on message send.
 */
export function useTypingEmitter({ channelId, directMessageGroupId }: UseTypingEmitterOptions) {
  const socket = useSocket();
  const lastEmitRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const roomPayload = channelId
    ? { channelId }
    : directMessageGroupId
      ? { directMessageGroupId }
      : null;

  const sendStart = useCallback(() => {
    if (!socket || !roomPayload) return;
    socket.emit(ClientEvents.TYPING_START, roomPayload);
    isTypingRef.current = true;
    lastEmitRef.current = Date.now();
  }, [socket, roomPayload]);

  const sendStop = useCallback(() => {
    if (!socket || !roomPayload || !isTypingRef.current) return;
    socket.emit(ClientEvents.TYPING_STOP, roomPayload);
    isTypingRef.current = false;
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, [socket, roomPayload]);

  const handleKeyPress = useCallback(() => {
    const now = Date.now();

    // Debounce: don't re-emit if we sent within TYPING_DEBOUNCE_MS
    if (now - lastEmitRef.current > TYPING_DEBOUNCE_MS) {
      sendStart();
    }

    // Reset idle timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      sendStop();
    }, TYPING_IDLE_MS);
  }, [sendStart, sendStop]);

  // Cleanup on unmount or context change
  useEffect(() => {
    return () => {
      if (isTypingRef.current && socket && roomPayload) {
        socket.emit(ClientEvents.TYPING_STOP, roomPayload);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [socket, roomPayload]);

  return { handleKeyPress, sendTypingStop: sendStop };
}
