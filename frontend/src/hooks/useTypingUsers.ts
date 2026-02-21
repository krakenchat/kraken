import { useState, useCallback, useRef, useEffect } from 'react';
import { ServerEvents } from '@kraken/shared';
import type { UserTypingPayload } from '@kraken/shared';
import { useServerEvent } from '../socket-hub/useServerEvent';

const TYPING_TIMEOUT_MS = 8_000;

interface UseTypingUsersOptions {
  channelId?: string;
  directMessageGroupId?: string;
  currentUserId?: string;
}

/**
 * Tracks which users are currently typing in a given channel or DM group.
 * Auto-clears after 8s as a safety net for missed TYPING_STOP events.
 */
export function useTypingUsers({
  channelId,
  directMessageGroupId,
  currentUserId,
}: UseTypingUsersOptions): string[] {
  const [typingUsers, setTypingUsers] = useState<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const typingUsersRef = useRef(typingUsers);
  typingUsersRef.current = typingUsers;

  const clearUser = useCallback((userId: string) => {
    setTypingUsers((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Map(prev);
      const timer = next.get(userId);
      if (timer) clearTimeout(timer);
      next.delete(userId);
      return next;
    });
  }, []);

  useServerEvent(ServerEvents.USER_TYPING, useCallback((payload: UserTypingPayload) => {
    // Only handle events for our context
    const matchesContext = channelId
      ? payload.channelId === channelId
      : directMessageGroupId
        ? payload.directMessageGroupId === directMessageGroupId
        : false;

    if (!matchesContext) return;

    // Ignore our own typing events
    if (payload.userId === currentUserId) return;

    if (payload.isTyping) {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        // Clear existing timer for this user
        const existingTimer = next.get(payload.userId);
        if (existingTimer) clearTimeout(existingTimer);
        // Set new timeout
        const timer = setTimeout(() => clearUser(payload.userId), TYPING_TIMEOUT_MS);
        next.set(payload.userId, timer);
        return next;
      });
    } else {
      clearUser(payload.userId);
    }
  }, [channelId, directMessageGroupId, currentUserId, clearUser]));

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      typingUsersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return Array.from(typingUsers.keys());
}
