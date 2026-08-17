import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test-utils';
import { ProfileRedirect } from '../../components/ProfileRedirect';

const mockUseCurrentUser = vi.fn();
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

function renderProfileRedirect(initialEntry = '/profile') {
  return renderWithProviders(
    <Routes>
      <Route path="/profile" element={<ProfileRedirect />} />
      <Route path="/profile/:userId" element={<div>User profile page</div>} />
      <Route path="/" element={<div>Home page</div>} />
    </Routes>,
    { routerProps: { initialEntries: [initialEntry] } },
  );
}

describe('ProfileRedirect', () => {
  beforeEach(() => {
    mockUseCurrentUser.mockReset();
  });

  it('shows a loading spinner while the current user is loading', () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined, isLoading: true });

    renderProfileRedirect();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('User profile page')).not.toBeInTheDocument();
    expect(screen.queryByText('Home page')).not.toBeInTheDocument();
  });

  it('redirects to the current user\'s profile route when a user is present', () => {
    mockUseCurrentUser.mockReturnValue({ user: { id: 'user-42' }, isLoading: false });

    renderProfileRedirect();

    expect(screen.getByText('User profile page')).toBeInTheDocument();
  });

  it('redirects to the fallback route ("/") when no user is present', () => {
    mockUseCurrentUser.mockReturnValue({ user: undefined, isLoading: false });

    renderProfileRedirect();

    expect(screen.getByText('Home page')).toBeInTheDocument();
  });
});
