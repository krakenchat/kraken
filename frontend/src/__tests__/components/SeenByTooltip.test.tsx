import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { renderWithProviders } from '../test-utils';
import { SeenByTooltip } from '../../components/Message/SeenByTooltip';
import type { MessageReader } from '../../types/read-receipt.type';

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

const BASE_URL = 'http://localhost:3000';

const defaultProps = () => ({
  messageId: 'msg-1',
  directMessageGroupId: 'dm-group-1',
});

describe('SeenByTooltip', () => {
  beforeAll(() => server.listen());
  afterAll(() => server.close());
  afterEach(() => server.resetHandlers());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders check icon initially (before hover/data fetch)', () => {
    // Before hovering, the query is disabled so no readers are fetched.
    // The default readStatus should be "sent" which shows DoneIcon.
    server.use(
      http.get(`${BASE_URL}/api/read-receipts/message/:messageId/readers`, () => {
        return HttpResponse.json([]);
      })
    );

    renderWithProviders(<SeenByTooltip {...defaultProps()} />);

    // DoneIcon (check) should be visible for "sent" status
    expect(screen.getByTestId('DoneIcon')).toBeInTheDocument();
    expect(screen.queryByTestId('VisibilityIcon')).not.toBeInTheDocument();
  });

  it('shows eye icon after readers data is loaded on hover', async () => {
    const readers: MessageReader[] = [
      {
        userId: 'u2',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: undefined,
        readAt: new Date(),
      },
    ];

    server.use(
      http.get(`${BASE_URL}/api/read-receipts/message/:messageId/readers`, () => {
        return HttpResponse.json(readers);
      })
    );

    const { user } = renderWithProviders(<SeenByTooltip {...defaultProps()} />);

    // Initially should show check icon (sent)
    expect(screen.getByTestId('DoneIcon')).toBeInTheDocument();

    // Hover to trigger the tooltip open and data fetch
    const indicator = screen.getByTestId('DoneIcon').closest('span')!;
    await user.hover(indicator);

    // After data loads, the status should switch to "read" and show VisibilityIcon
    await waitFor(() => {
      expect(screen.getByTestId('VisibilityIcon')).toBeInTheDocument();
    });

    // The tooltip should show "Seen by" header and the reader name
    expect(screen.getByText('Seen by')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows "Not seen yet" text when readers list is empty after loading', async () => {
    server.use(
      http.get(`${BASE_URL}/api/read-receipts/message/:messageId/readers`, () => {
        return HttpResponse.json([]);
      })
    );

    const { user } = renderWithProviders(<SeenByTooltip {...defaultProps()} />);

    // Hover to trigger fetch
    const indicator = screen.getByTestId('DoneIcon').closest('span')!;
    await user.hover(indicator);

    // After data loads with empty array, tooltip should show "Not seen yet"
    await waitFor(() => {
      expect(screen.getByText('Not seen yet')).toBeInTheDocument();
    });

    // Status should remain "sent" (check icon) since no readers
    expect(screen.getByTestId('DoneIcon')).toBeInTheDocument();
    expect(screen.queryByTestId('VisibilityIcon')).not.toBeInTheDocument();
  });
});
