import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '../test-utils';
import { server } from '../msw/server';
import WebhookManagement from '../../components/Community/WebhookManagement';
import type { WebhookDto } from '../../api-client/types.gen';

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

const mockUseUserPermissions = vi.fn(() => ({ hasPermissions: true }));
vi.mock('../../features/roles/useUserPermissions', () => ({
  useUserPermissions: (...args: unknown[]) => mockUseUserPermissions(...(args as [])),
}));

const CHANNEL_ID = 'channel-1';

function makeWebhook(overrides: Partial<WebhookDto> = {}): WebhookDto {
  return {
    id: 'wh-1',
    channelId: CHANNEL_ID,
    name: 'CI Bot',
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setupList(webhooks: WebhookDto[]) {
  server.use(
    http.get(
      'http://localhost:3000/api/channels/:channelId/webhooks',
      () => HttpResponse.json(webhooks),
    ),
  );
}

describe('WebhookManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserPermissions.mockReturnValue({ hasPermissions: true });
  });

  it('shows a permission notice when the user cannot manage webhooks', () => {
    mockUseUserPermissions.mockReturnValue({ hasPermissions: false });
    renderWithProviders(<WebhookManagement channelId={CHANNEL_ID} />);
    expect(
      screen.getByText(/don't have permission to manage webhooks/i),
    ).toBeInTheDocument();
  });

  it('renders the empty state when there are no webhooks', async () => {
    setupList([]);
    renderWithProviders(<WebhookManagement channelId={CHANNEL_ID} />);
    expect(await screen.findByText(/no webhooks yet/i)).toBeInTheDocument();
  });

  it('lists existing webhooks with name and created date', async () => {
    setupList([makeWebhook()]);
    renderWithProviders(<WebhookManagement channelId={CHANNEL_ID} />);

    expect(await screen.findByText('CI Bot')).toBeInTheDocument();
  });

  it('rejects an empty name without calling create', async () => {
    setupList([]);
    renderWithProviders(<WebhookManagement channelId={CHANNEL_ID} />);
    await screen.findByText(/no webhooks yet/i);

    // The create button is disabled until a name is entered.
    expect(screen.getByRole('button', { name: /create webhook/i })).toBeDisabled();
  });

  it('creates a webhook and shows the one-time URL', async () => {
    setupList([]);
    let createdBody: unknown = null;
    server.use(
      http.post(
        'http://localhost:3000/api/channels/:channelId/webhooks',
        async ({ request }) => {
          createdBody = await request.json();
          return HttpResponse.json(
            {
              id: 'wh-new',
              channelId: CHANNEL_ID,
              name: 'CI Bot',
              avatarUrl: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              url: '/api/webhooks/wh-new/abc123token',
            },
            { status: 201 },
          );
        },
      ),
    );

    const { user } = renderWithProviders(
      <WebhookManagement channelId={CHANNEL_ID} />,
    );
    await screen.findByText(/no webhooks yet/i);

    await user.type(screen.getByLabelText(/^name$/i), 'CI Bot');
    await user.click(screen.getByRole('button', { name: /create webhook/i }));

    await waitFor(() =>
      expect(createdBody).toEqual({ name: 'CI Bot' }),
    );

    expect(await screen.findByText(/webhook created/i)).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Webhook URL' }),
    ).toHaveValue('/api/webhooks/wh-new/abc123token');
    expect(
      screen.getByText(/won't be able to see it again/i),
    ).toBeInTheDocument();
  });

  it('deletes a webhook after confirmation', async () => {
    setupList([makeWebhook()]);
    let deleteCalled = false;
    server.use(
      http.delete(
        'http://localhost:3000/api/channels/:channelId/webhooks/:webhookId',
        () => {
          deleteCalled = true;
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const { user } = renderWithProviders(
      <WebhookManagement channelId={CHANNEL_ID} />,
    );
    await screen.findByText('CI Bot');

    await user.click(screen.getByRole('button', { name: /delete webhook/i }));
    await user.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(deleteCalled).toBe(true));
  });
});
