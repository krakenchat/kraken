import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '../test-utils';
import { server } from '../msw/server';
import SoundboardManagement from '../../components/Community/SoundboardManagement';
import type { SoundboardSoundDto } from '../../api-client/types.gen';

vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

// All permissions granted by default
vi.mock('../../features/roles/useUserPermissions', () => ({
  useUserPermissions: vi.fn(() => ({ hasPermissions: true })),
}));

// Avoid the authenticated-file/blob dependency of the real preview button
vi.mock('../../components/Community/SoundPreviewButton', () => ({
  SoundPreviewButton: ({ fileId }: { fileId: string }) => (
    <div data-testid={`preview-${fileId}`} />
  ),
}));

const uploadFileMock = vi.fn();
vi.mock('../../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    uploadFile: uploadFileMock,
    isUploading: false,
    error: null,
    resetError: vi.fn(),
  }),
}));

const communityId = 'comm-1';

function makeSound(overrides: Partial<SoundboardSoundDto> = {}): SoundboardSoundDto {
  return {
    id: 'sound-1',
    communityId,
    name: 'airhorn',
    emoji: '📯',
    fileId: 'file-1',
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const listUrl = `http://localhost:3000/api/soundboard/community/${communityId}`;

describe('SoundboardManagement', () => {
  beforeEach(() => {
    uploadFileMock.mockReset();
  });

  it('renders the list of community sounds', async () => {
    server.use(
      http.get(listUrl, () =>
        HttpResponse.json([makeSound(), makeSound({ id: 'sound-2', name: 'boo', emoji: null })]),
      ),
    );

    renderWithProviders(<SoundboardManagement communityId={communityId} />);

    expect(await screen.findByText('airhorn')).toBeInTheDocument();
    expect(screen.getByText('boo')).toBeInTheDocument();
  });

  it('shows the empty state when there are no sounds', async () => {
    server.use(http.get(listUrl, () => HttpResponse.json([])));

    renderWithProviders(<SoundboardManagement communityId={communityId} />);

    expect(await screen.findByText('No sounds yet')).toBeInTheDocument();
  });

  it('uploads and creates a sound through the add dialog', async () => {
    uploadFileMock.mockResolvedValue({ id: 'file-new' });
    const createCalls: unknown[] = [];

    server.use(
      http.get(listUrl, () => HttpResponse.json([])),
      http.post(listUrl, async ({ request }) => {
        const body = await request.json();
        createCalls.push(body);
        return HttpResponse.json(makeSound({ id: 'sound-new', name: 'yay', fileId: 'file-new' }));
      }),
    );

    const { user } = renderWithProviders(
      <SoundboardManagement communityId={communityId} />,
    );

    await screen.findByText('No sounds yet');
    await user.click(screen.getByRole('button', { name: /add your first sound/i }));

    const nameInput = await screen.findByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'yay');

    const file = new File([new Uint8Array([1, 2, 3])], 'yay.mp3', { type: 'audio/mpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /^add sound$/i }));

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(file, {
        resourceType: 'SOUNDBOARD_SOUND',
        resourceId: communityId,
      });
    });
    await waitFor(() => {
      expect(createCalls).toHaveLength(1);
    });
    expect(createCalls[0]).toMatchObject({ name: 'yay', fileId: 'file-new' });
  });

  it('deletes a sound after confirmation', async () => {
    let deleted = false;
    server.use(
      http.get(listUrl, () => HttpResponse.json([makeSound()])),
      http.delete(
        `${listUrl}/sound-1`,
        () => {
          deleted = true;
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const { user } = renderWithProviders(
      <SoundboardManagement communityId={communityId} />,
    );

    await screen.findByText('airhorn');
    await user.click(screen.getByRole('button', { name: /delete sound/i }));

    // Confirm dialog
    const confirmButton = await screen.findByRole('button', { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => expect(deleted).toBe(true));
  });
});
