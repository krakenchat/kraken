import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('../../utils/tokenService', () => ({
  getAccessToken: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  getApiUrl: vi.fn((path: string) => `http://localhost:3000/api${path}`),
}));

import { getStreamUrl } from '../../utils/fileStream';
import { getAccessToken } from '../../utils/tokenService';

describe('getStreamUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return URL with token query parameter', () => {
    vi.mocked(getAccessToken).mockReturnValue('my-jwt-token');

    const url = getStreamUrl('file-123');

    expect(url).toBe(
      'http://localhost:3000/api/file/file-123?token=my-jwt-token',
    );
  });

  it('should URL-encode the token', () => {
    vi.mocked(getAccessToken).mockReturnValue('token+with/special=chars');

    const url = getStreamUrl('file-abc');

    expect(url).toContain('token=token%2Bwith%2Fspecial%3Dchars');
  });

  it('should return URL without token when no access token available', () => {
    vi.mocked(getAccessToken).mockReturnValue(null);

    const url = getStreamUrl('file-456');

    expect(url).toBe('http://localhost:3000/api/file/file-456');
    expect(url).not.toContain('token=');
  });

  it('should use the correct file ID in the URL path', () => {
    vi.mocked(getAccessToken).mockReturnValue('jwt');

    const url = getStreamUrl('abc-def-123');

    expect(url).toContain('/file/abc-def-123');
  });
});
