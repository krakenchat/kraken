import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createMessage } from '../test-utils';

const mockCanPerformAction = vi.fn();
vi.mock('../../features/roles/useUserPermissions', () => ({
  useCanPerformAction: (...args: unknown[]) => mockCanPerformAction(...args),
}));

import { useMessagePermissions } from '../../hooks/useMessagePermissions';

describe('useMessagePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockReturnValue(false);
  });

  it('returns canEdit=true, canDelete=true, isOwnMessage=true for own message', () => {
    const message = createMessage({ authorId: 'user-1' });
    const { result } = renderHook(() =>
      useMessagePermissions({ message, currentUserId: 'user-1' }),
    );

    expect(result.current.isOwnMessage).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });

  it('returns canEdit=false, canDelete=false for others message without permission', () => {
    const message = createMessage({ authorId: 'other-user' });
    const { result } = renderHook(() =>
      useMessagePermissions({ message, currentUserId: 'user-1' }),
    );

    expect(result.current.isOwnMessage).toBe(false);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
  });

  it('returns canDelete=true for others message with DELETE_MESSAGE permission', () => {
    mockCanPerformAction.mockImplementation(
      (_type: string, _id: string, action: string) => {
        return action === 'DELETE_MESSAGE';
      },
    );
    const message = createMessage({ authorId: 'other-user' });
    const { result } = renderHook(() =>
      useMessagePermissions({ message, currentUserId: 'user-1' }),
    );

    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(true);
  });

  it('returns all false when currentUserId is undefined', () => {
    const message = createMessage({ authorId: 'user-1' });
    const { result } = renderHook(() =>
      useMessagePermissions({ message, currentUserId: undefined }),
    );

    expect(result.current.isOwnMessage).toBe(false);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
  });

  it('returns canPin=true when user has PIN_MESSAGE permission', () => {
    mockCanPerformAction.mockImplementation(
      (_type: string, _id: string, action: string) => {
        return action === 'PIN_MESSAGE';
      },
    );
    const message = createMessage({ authorId: 'other-user' });
    const { result } = renderHook(() =>
      useMessagePermissions({ message, currentUserId: 'user-1' }),
    );

    expect(result.current.canPin).toBe(true);
  });

  it('correctly identifies own vs others message via isOwnMessage', () => {
    const message = createMessage({ authorId: 'user-1' });

    const { result: ownResult } = renderHook(() =>
      useMessagePermissions({ message, currentUserId: 'user-1' }),
    );
    expect(ownResult.current.isOwnMessage).toBe(true);

    const { result: otherResult } = renderHook(() =>
      useMessagePermissions({ message, currentUserId: 'user-2' }),
    );
    expect(otherResult.current.isOwnMessage).toBe(false);
  });
});
