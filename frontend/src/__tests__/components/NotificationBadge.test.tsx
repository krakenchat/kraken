import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, createTestQueryClient } from '../test-utils';
import { NotificationBadge } from '../../components/Notifications/NotificationBadge';
import { notificationsControllerGetUnreadCountQueryKey } from '../../api-client/@tanstack/react-query.gen';

vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

describe('NotificationBadge', () => {
  let onClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClick = vi.fn();
  });

  it('renders with unread count from query cache', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(notificationsControllerGetUnreadCountQueryKey(), { count: 5 });

    renderWithProviders(<NotificationBadge onClick={onClick} />, { queryClient });

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByLabelText('5 unread notifications')).toBeInTheDocument();
  });

  it('renders 0 badge when cache is empty', () => {
    renderWithProviders(<NotificationBadge onClick={onClick} />);

    // Badge with 0 is hidden by MUI by default, but aria-label still reflects it
    expect(screen.getByLabelText('0 unread notifications')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const { user } = renderWithProviders(<NotificationBadge onClick={onClick} />);

    await user.click(screen.getByLabelText('0 unread notifications'));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('caps displayed count at 99', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(notificationsControllerGetUnreadCountQueryKey(), { count: 150 });

    renderWithProviders(<NotificationBadge onClick={onClick} />, { queryClient });

    expect(screen.getByText('99+')).toBeInTheDocument();
    expect(screen.getByLabelText('150 unread notifications')).toBeInTheDocument();
  });

  it('does not use polling (no refetchInterval)', () => {
    const queryClient = createTestQueryClient();
    renderWithProviders(<NotificationBadge onClick={onClick} />, { queryClient });

    const queries = queryClient.getQueryCache().getAll();
    const unreadQuery = queries.find(
      (q) => JSON.stringify(q.queryKey) === JSON.stringify(notificationsControllerGetUnreadCountQueryKey()),
    );
    // The query should exist but should not have a refetch interval set
    expect(unreadQuery).toBeDefined();
    expect(unreadQuery?.options.refetchInterval).toBeUndefined();
  });
});
