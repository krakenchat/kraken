import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import MemberList, { type MemberData } from '../../components/Message/MemberList';

/**
 * Focus-restoration coverage for MemberList's right-click context menu
 * (`UserModerationMenu`, opened via `useContextMenuFocusRestore`).
 *
 * Unlike MemberList.test.tsx (which stubs UserModerationMenu to `() => null`
 * for rendering-only assertions), this file renders the real
 * `UserModerationMenu` so Escape/onClose actually fires and the
 * focus-restoration path can be exercised end-to-end. Covers both:
 *  (a) the normal case — the row that opened the menu is still mounted, so
 *      focus returns to it; and
 *  (b) the presence-driven edge case — the row unmounts (e.g. the member
 *      goes offline/leaves) while the menu is still open, so restoreFocus
 *      falls back to the list's scroll container instead of no-oping on a
 *      detached node.
 */

vi.mock('../../contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ openProfile: vi.fn() }),
}));

vi.mock('../../components/Common/UserAvatar', () => ({
  default: () => <div data-testid="user-avatar" />,
}));

const mockCanPerformAction = vi.fn((..._args: unknown[]) => false);
vi.mock('../../features/roles/useUserPermissions', () => ({
  useCanPerformAction: (...args: unknown[]) => mockCanPerformAction(...args),
}));

vi.mock('../../components/Moderation/BanDialog', () => ({
  default: () => null,
}));
vi.mock('../../components/Moderation/TimeoutDialog', () => ({
  default: () => null,
}));
vi.mock('../../components/Moderation/KickConfirmDialog', () => ({
  default: () => null,
}));

function createMember(overrides: Partial<MemberData> = {}): MemberData {
  return {
    id: overrides.id ?? `user-${Math.random().toString(36).slice(2)}`,
    username: overrides.username ?? 'testuser',
    displayName: overrides.displayName ?? null,
    avatarUrl: overrides.avatarUrl ?? null,
    isOnline: overrides.isOnline ?? true,
    status: overrides.status ?? null,
    displayRole: overrides.displayRole ?? undefined,
  };
}

describe('MemberList context menu focus restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockReturnValue(false);
  });

  it('restores focus to the member row on Escape when the row is still mounted', async () => {
    const members: MemberData[] = [
      createMember({ id: 'user-a', username: 'alice', displayName: 'Alice' }),
      createMember({ id: 'user-b', username: 'bob', displayName: 'Bob' }),
    ];

    renderWithProviders(<MemberList members={members} communityId="community-1" />);

    const aliceRow = screen.getByText('Alice').closest('div[role="button"]') as HTMLElement;
    expect(aliceRow).not.toBeNull();

    fireEvent.contextMenu(aliceRow, { clientX: 10, clientY: 10 });
    const menu = await screen.findByRole('menu');

    fireEvent.keyDown(menu, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(aliceRow);
    });
  });

  it('falls back to the list container when the triggering row unmounts before the menu finishes closing', async () => {
    const members: MemberData[] = [
      createMember({ id: 'user-a', username: 'alice', displayName: 'Alice' }),
      createMember({ id: 'user-b', username: 'bob', displayName: 'Bob' }),
    ];

    const { rerender } = renderWithProviders(
      <MemberList members={members} communityId="community-1" />,
    );

    // Capture the scroll container reference before the menu opens — once
    // open, MUI's Modal marks all other content `aria-hidden`, which would
    // hide it from a `getByRole('list')` query.
    const listContainer = screen.getByRole('list').parentElement as HTMLElement;

    const aliceRow = screen.getByText('Alice').closest('div[role="button"]') as HTMLElement;
    fireEvent.contextMenu(aliceRow, { clientX: 10, clientY: 10 });
    const menu = await screen.findByRole('menu');

    // Simulate Alice going offline/leaving while the menu is still open —
    // her row unmounts, but the menu (keyed off contextMenu.member in
    // component state, not the members array) stays open.
    rerender(
      <MemberList
        members={[createMember({ id: 'user-b', username: 'bob', displayName: 'Bob' })]}
        communityId="community-1"
      />,
    );
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();

    fireEvent.keyDown(menu, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(listContainer);
    });
  });
});
