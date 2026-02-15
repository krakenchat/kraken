import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import UserModerationMenu from '../../components/Moderation/UserModerationMenu';

const mockCanPerformAction = vi.fn();
vi.mock('../../features/roles/useUserPermissions', () => ({
  useCanPerformAction: (...args: unknown[]) => mockCanPerformAction(...args),
}));

vi.mock('../../components/Moderation/BanDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="ban-dialog"><button onClick={onClose}>Close Ban</button></div> : null,
}));

vi.mock('../../components/Moderation/TimeoutDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="timeout-dialog"><button onClick={onClose}>Close Timeout</button></div> : null,
}));

vi.mock('../../components/Moderation/KickConfirmDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="kick-dialog"><button onClick={onClose}>Close Kick</button></div> : null,
}));

function setPermissions(perms: { kick?: boolean; timeout?: boolean; ban?: boolean }) {
  mockCanPerformAction.mockImplementation((_type: string, _id: string, action: string) => {
    if (action === 'KICK_USER') return perms.kick ?? false;
    if (action === 'TIMEOUT_USER') return perms.timeout ?? false;
    if (action === 'BAN_USER') return perms.ban ?? false;
    return false;
  });
}

let anchorEl: HTMLDivElement;

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  communityId: 'community-1',
  targetUserId: 'user-target',
  targetUserName: 'TestUser',
};

describe('UserModerationMenu', () => {
  beforeEach(() => {
    anchorEl = document.createElement('div');
    document.body.appendChild(anchorEl);
    defaultProps.onClose = vi.fn();
    mockCanPerformAction.mockReset();
  });

  afterEach(() => {
    if (anchorEl && anchorEl.parentNode) {
      document.body.removeChild(anchorEl);
    }
  });

  it('shows Kick menu item when user has kick permission', () => {
    setPermissions({ kick: true });

    renderWithProviders(
      <UserModerationMenu {...defaultProps} anchorEl={anchorEl} />,
    );

    expect(screen.getByText('Kick')).toBeInTheDocument();
  });

  it('shows Timeout menu item when user has timeout permission', () => {
    setPermissions({ timeout: true });

    renderWithProviders(
      <UserModerationMenu {...defaultProps} anchorEl={anchorEl} />,
    );

    expect(screen.getByText('Timeout')).toBeInTheDocument();
  });

  it('shows Ban menu item when user has ban permission', () => {
    setPermissions({ ban: true });

    renderWithProviders(
      <UserModerationMenu {...defaultProps} anchorEl={anchorEl} />,
    );

    expect(screen.getByText('Ban')).toBeInTheDocument();
  });

  it('hides moderation items when user has no permissions', () => {
    setPermissions({});

    renderWithProviders(
      <UserModerationMenu {...defaultProps} anchorEl={anchorEl} />,
    );

    expect(screen.queryByText('Kick')).not.toBeInTheDocument();
    expect(screen.queryByText('Timeout')).not.toBeInTheDocument();
    expect(screen.queryByText('Ban')).not.toBeInTheDocument();
  });

  it('shows View Profile when onViewProfile is provided', () => {
    setPermissions({});
    const onViewProfile = vi.fn();

    renderWithProviders(
      <UserModerationMenu {...defaultProps} anchorEl={anchorEl} onViewProfile={onViewProfile} />,
    );

    expect(screen.getByText('View Profile')).toBeInTheDocument();
  });

  it('opens KickConfirmDialog when Kick is clicked', async () => {
    setPermissions({ kick: true });

    const { user } = renderWithProviders(
      <UserModerationMenu {...defaultProps} anchorEl={anchorEl} />,
    );

    await user.click(screen.getByText('Kick'));

    expect(screen.getByTestId('kick-dialog')).toBeInTheDocument();
  });

  it('opens BanDialog when Ban is clicked', async () => {
    setPermissions({ ban: true });

    const { user } = renderWithProviders(
      <UserModerationMenu {...defaultProps} anchorEl={anchorEl} />,
    );

    await user.click(screen.getByText('Ban'));

    expect(screen.getByTestId('ban-dialog')).toBeInTheDocument();
  });
});
