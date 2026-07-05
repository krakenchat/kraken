import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '../test-utils';
import { server } from '../msw/server';
import CustomEmojiManagement from '../../components/Community/CustomEmojiManagement';
import type { CustomEmojiDto } from '../../api-client/types.gen';

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

// Permission mock — overridden per-test where needed.
const mockUseUserPermissions = vi.fn(() => ({ hasPermissions: true }));
vi.mock('../../features/roles/useUserPermissions', () => ({
  useUserPermissions: (...args: unknown[]) => mockUseUserPermissions(...(args as [])),
}));

// File-upload mock.
const mockUploadFile = vi.fn(async () => ({ id: 'file-new' }));
vi.mock('../../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    uploadFile: mockUploadFile,
    isUploading: false,
    error: null,
    resetError: vi.fn(),
  }),
}));

const COMMUNITY_ID = 'community-1';

function makeEmoji(overrides: Partial<CustomEmojiDto> = {}): CustomEmojiDto {
  return {
    id: 'e1',
    communityId: COMMUNITY_ID,
    name: 'party_blob',
    fileId: 'file-1',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setupList(emojis: CustomEmojiDto[]) {
  server.use(
    http.get(
      'http://localhost:3000/api/custom-emoji/community/:communityId',
      () => HttpResponse.json(emojis),
    ),
  );
}

describe('CustomEmojiManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserPermissions.mockReturnValue({ hasPermissions: true });
  });

  it('shows a permission notice when the user cannot manage emojis', () => {
    mockUseUserPermissions.mockReturnValue({ hasPermissions: false });
    renderWithProviders(<CustomEmojiManagement communityId={COMMUNITY_ID} />);
    expect(
      screen.getByText(/don't have permission to manage custom emojis/i),
    ).toBeInTheDocument();
  });

  it('renders the empty state when there are no emojis', async () => {
    setupList([]);
    renderWithProviders(<CustomEmojiManagement communityId={COMMUNITY_ID} />);
    expect(await screen.findByText(/no custom emojis yet/i)).toBeInTheDocument();
  });

  it('lists existing emojis with a preview image and shortcode', async () => {
    setupList([makeEmoji()]);
    renderWithProviders(<CustomEmojiManagement communityId={COMMUNITY_ID} />);

    const img = await screen.findByRole('img', { name: ':party_blob:' });
    expect(img).toHaveAttribute('src', '/api/file/file-1');
    expect(screen.getByText(':party_blob:')).toBeInTheDocument();
  });

  it('rejects an invalid shortcode without uploading', async () => {
    setupList([]);
    const { user } = renderWithProviders(
      <CustomEmojiManagement communityId={COMMUNITY_ID} />,
    );
    await screen.findByText(/no custom emojis yet/i);

    await user.type(screen.getByLabelText(/shortcode/i), 'Bad Name!');
    await user.click(screen.getByRole('button', { name: /add emoji/i }));

    expect(
      await screen.findByText(/must be 2-32 characters/i),
    ).toBeInTheDocument();
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('rejects a letterless shortcode (digits/underscores only)', async () => {
    setupList([]);
    const { user } = renderWithProviders(
      <CustomEmojiManagement communityId={COMMUNITY_ID} />,
    );
    await screen.findByText(/no custom emojis yet/i);

    await user.type(screen.getByLabelText(/shortcode/i), '123_45');
    await user.click(screen.getByRole('button', { name: /add emoji/i }));

    expect(
      await screen.findByText(/at least one letter/i),
    ).toBeInTheDocument();
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('uploads the file then creates the emoji on submit', async () => {
    setupList([]);
    let created: unknown = null;
    server.use(
      http.post(
        'http://localhost:3000/api/custom-emoji/community/:communityId',
        async ({ request }) => {
          created = await request.json();
          return HttpResponse.json(makeEmoji({ id: 'e2', name: 'cat_jam' }), {
            status: 201,
          });
        },
      ),
    );

    const { container, user } = renderWithProviders(
      <CustomEmojiManagement communityId={COMMUNITY_ID} />,
    );
    await screen.findByText(/no custom emojis yet/i);

    await user.type(screen.getByLabelText(/shortcode/i), 'cat_jam');
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['x'], 'cat.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /add emoji/i }));

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));
    expect(mockUploadFile).toHaveBeenCalledWith(file, {
      resourceType: 'CUSTOM_EMOJI',
      resourceId: COMMUNITY_ID,
    });
    await waitFor(() =>
      expect(created).toEqual({ name: 'cat_jam', fileId: 'file-new' }),
    );
  });
});
