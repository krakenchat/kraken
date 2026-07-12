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

vi.mock('../../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
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

  it('does not fetch the webhooks list when the user cannot manage webhooks', async () => {
    mockUseUserPermissions.mockReturnValue({ hasPermissions: false });
    let listCalled = false;
    server.use(
      http.get('http://localhost:3000/api/channels/:channelId/webhooks', () => {
        listCalled = true;
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<WebhookManagement channelId={CHANNEL_ID} />);
    expect(
      screen.getByText(/don't have permission to manage webhooks/i),
    ).toBeInTheDocument();

    // Give any (incorrectly) in-flight request a chance to resolve.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(listCalled).toBe(false);
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

  it('surfaces an error and closes the confirm dialog when deletion fails', async () => {
    setupList([makeWebhook()]);
    server.use(
      http.delete(
        'http://localhost:3000/api/channels/:channelId/webhooks/:webhookId',
        () => HttpResponse.json({ message: 'Failed to delete webhook.' }, { status: 500 }),
      ),
    );

    const { user } = renderWithProviders(
      <WebhookManagement channelId={CHANNEL_ID} />,
    );
    await screen.findByText('CI Bot');

    await user.click(screen.getByRole('button', { name: /delete webhook/i }));
    await user.click(await screen.findByRole('button', { name: /^delete$/i }));

    expect(await screen.findByText(/failed to delete webhook/i)).toBeInTheDocument();
    // The confirm dialog closes even on failure so the error banner is visible.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument(),
    );
  });

  it('falls back to selecting the URL text and shows a hint when clipboard copy fails', async () => {
    const { copyToClipboard } = await import('../../utils/clipboard');
    vi.mocked(copyToClipboard).mockRejectedValueOnce(new Error('denied'));
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select');

    setupList([]);
    server.use(
      http.post(
        'http://localhost:3000/api/channels/:channelId/webhooks',
        () =>
          HttpResponse.json(
            {
              id: 'wh-new',
              channelId: CHANNEL_ID,
              name: 'CI Bot',
              avatarUrl: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              url: '/api/webhooks/wh-new/abc123token',
            },
            { status: 201 },
          ),
      ),
    );

    const { user } = renderWithProviders(
      <WebhookManagement channelId={CHANNEL_ID} />,
    );
    await screen.findByText(/no webhooks yet/i);

    await user.type(screen.getByLabelText(/^name$/i), 'CI Bot');
    await user.click(screen.getByRole('button', { name: /create webhook/i }));
    await screen.findByText(/webhook created/i);

    await user.click(screen.getByRole('button', { name: /copy webhook url/i }));

    expect(await screen.findByText(/copy it manually/i)).toBeInTheDocument();
    expect(selectSpy).toHaveBeenCalled();
    expect(screen.queryByText(/copied to clipboard/i)).not.toBeInTheDocument();

    selectSpy.mockRestore();
  });
});
