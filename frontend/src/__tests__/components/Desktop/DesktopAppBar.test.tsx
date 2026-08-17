import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { DesktopAppBar } from '../../../components/Desktop/DesktopAppBar';
import type { User } from '../../../types/auth.type';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockHandleLogout = vi.fn();
let mockLogoutLoading = false;
vi.mock('../../../hooks/useLogout', () => ({
  useLogout: () => ({ handleLogout: mockHandleLogout, logoutLoading: mockLogoutLoading }),
}));

vi.mock('../../../components/NavBar/NavigationLinks', () => ({
  default: () => <div data-testid="navigation-links" />,
}));

vi.mock('../../../components/Notifications/NotificationBadge', () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="notification-badge" onClick={onClick}>notifications</button>
  ),
}));

vi.mock('../../../components/ThemeToggle/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}));

vi.mock('../../../components/Common/UserAvatar', () => ({
  default: () => <div data-testid="user-avatar" />,
}));

const baseUser: User = {
  id: 'user-1',
  username: 'alice',
  role: 'USER',
} as User;

function renderDesktopAppBar(overrides: Partial<React.ComponentProps<typeof DesktopAppBar>> = {}) {
  const onToggleMenu = vi.fn();
  const onNotificationCenterOpen = vi.fn();
  const utils = renderWithProviders(
    <DesktopAppBar
      instanceName="Semaphore Chat"
      isLoading={false}
      isError={false}
      userData={baseUser}
      onToggleMenu={onToggleMenu}
      onNotificationCenterOpen={onNotificationCenterOpen}
      {...overrides}
    />,
  );
  return { ...utils, onToggleMenu, onNotificationCenterOpen };
}

describe('DesktopAppBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogoutLoading = false;
  });

  it('opens the user menu when the avatar button is clicked', async () => {
    const { user } = renderDesktopAppBar();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open settings/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'My Profile' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
  });

  it('closes the user menu when it is dismissed', async () => {
    const { user } = renderDesktopAppBar();

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('navigates to the profile route when "My Profile" is clicked', async () => {
    const { user } = renderDesktopAppBar();

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'My Profile' }));

    expect(mockNavigate).toHaveBeenCalledWith('/profile/user-1');
  });

  it('navigates to /settings when "Settings" is clicked', async () => {
    const { user } = renderDesktopAppBar();

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('calls handleLogout when "Logout" is clicked', async () => {
    const { user } = renderDesktopAppBar();

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Logout' }));

    expect(mockHandleLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('invokes onToggleMenu when the menu icon button is clicked', async () => {
    const { user, onToggleMenu } = renderDesktopAppBar();

    await user.click(screen.getByRole('button', { name: /menu/i }));

    expect(onToggleMenu).toHaveBeenCalledTimes(1);
  });

  it('invokes onNotificationCenterOpen when the notification badge is clicked', async () => {
    const { user, onNotificationCenterOpen } = renderDesktopAppBar();

    await user.click(screen.getByTestId('notification-badge'));

    expect(onNotificationCenterOpen).toHaveBeenCalledTimes(1);
  });

  it('hides the notification badge and profile icon while isLoading', () => {
    renderDesktopAppBar({ isLoading: true });

    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument();
  });
});
