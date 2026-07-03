import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { generateTheme } from '../../theme/themeConfig';
import { VideoPreview } from '../../components/Message/VideoPreview';
import type { FileMetadata } from '../../types/message.type';

// Mock the file cache context
const mockFetchThumbnail = vi.fn();

vi.mock('../../contexts/AvatarCacheContext', () => ({
  useFileCache: vi.fn(() => ({
    fetchThumbnail: mockFetchThumbnail,
  })),
}));

// Mock the useVideoUrl hook (urlOverride lets tests simulate a signed-URL refresh)
const videoUrlMock = vi.hoisted(() => ({ urlOverride: null as string | null }));

vi.mock('../../hooks/useVideoUrl', () => ({
  useVideoUrl: vi.fn((fileId: string | null) =>
    fileId
      ? {
          url:
            videoUrlMock.urlOverride ??
            `http://localhost:3000/api/file/${fileId}`,
          isLoading: false,
          refresh: vi.fn(),
        }
      : { url: null, isLoading: false, refresh: vi.fn() },
  ),
}));

// jsdom does not implement HTMLMediaElement.play — stub it as a resolved promise
const playMock = vi.fn(() => Promise.resolve());
window.HTMLMediaElement.prototype.play = playMock;

const theme = generateTheme('dark', 'blue', 'balanced');

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('VideoPreview', () => {
  const baseMetadata: FileMetadata = {
    id: 'video-123',
    filename: 'test-video.mp4',
    mimeType: 'video/mp4',
    fileType: 'VIDEO',
    size: 52_428_800, // 50 MB
    hasThumbnail: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchThumbnail.mockResolvedValue('blob:thumbnail-url');
    videoUrlMock.urlOverride = null;
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('should render play button overlay', () => {
    renderWithTheme(<VideoPreview metadata={baseMetadata} />);

    // Play icon should be visible
    const playButton = screen.getByTestId('PlayArrowIcon');
    expect(playButton).toBeDefined();
  });

  it('should display file size badge', () => {
    renderWithTheme(<VideoPreview metadata={baseMetadata} />);

    expect(screen.getByText('50 MB')).toBeDefined();
  });

  it('should fetch thumbnail when hasThumbnail is true', () => {
    renderWithTheme(<VideoPreview metadata={baseMetadata} />);

    expect(mockFetchThumbnail).toHaveBeenCalledWith('video-123');
  });

  it('should not fetch thumbnail when hasThumbnail is false', () => {
    const noThumbMetadata = { ...baseMetadata, hasThumbnail: false };

    renderWithTheme(<VideoPreview metadata={noThumbMetadata} />);

    expect(mockFetchThumbnail).not.toHaveBeenCalled();
  });

  it('should show generic placeholder when no thumbnail', () => {
    const noThumbMetadata = { ...baseMetadata, hasThumbnail: false };

    renderWithTheme(<VideoPreview metadata={noThumbMetadata} />);

    // Should show the filename and video icon
    expect(screen.getByText('test-video.mp4')).toBeDefined();
    expect(screen.getByTestId('VideocamIcon')).toBeDefined();
  });

  it('should switch to video player when clicked', () => {
    renderWithTheme(<VideoPreview metadata={baseMetadata} />);

    // Click the thumbnail container (play button area)
    const playButton = screen.getByTestId('PlayArrowIcon');
    fireEvent.click(playButton);

    // After clicking, a <video> element should appear
    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.src).toContain('/api/file/video-123');
  });

  it('should not have the autoplay attribute on the video element', () => {
    renderWithTheme(<VideoPreview metadata={baseMetadata} />);

    fireEvent.click(screen.getByTestId('PlayArrowIcon'));

    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.hasAttribute('autoplay')).toBe(false);
    expect(video?.autoplay).toBe(false);
  });

  it('should call play() exactly once when the user clicks play', () => {
    renderWithTheme(<VideoPreview metadata={baseMetadata} />);

    fireEvent.click(screen.getByTestId('PlayArrowIcon'));

    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it('should format small file sizes correctly', () => {
    const smallMetadata = { ...baseMetadata, size: 512 };

    renderWithTheme(<VideoPreview metadata={smallMetadata} />);

    expect(screen.getByText('512 Bytes')).toBeDefined();
  });

  it('should format KB file sizes correctly', () => {
    const kbMetadata = { ...baseMetadata, size: 150_000 };

    renderWithTheme(<VideoPreview metadata={kbMetadata} />);

    expect(screen.getByText('146.48 KB')).toBeDefined();
  });

  it('should format GB file sizes correctly', () => {
    const gbMetadata = { ...baseMetadata, size: 2_147_483_648 };

    renderWithTheme(<VideoPreview metadata={gbMetadata} />);

    expect(screen.getByText('2 GB')).toBeDefined();
  });

  describe('edge cases', () => {
    it('should show loading spinner while thumbnail is being fetched', () => {
      // Make fetchThumbnail never resolve (simulates slow network)
      mockFetchThumbnail.mockReturnValue(new Promise(() => {}));

      renderWithTheme(<VideoPreview metadata={baseMetadata} />);

      expect(screen.getByRole('progressbar')).toBeDefined();
    });

    it('should fall back to generic placeholder when thumbnail fetch fails', async () => {
      mockFetchThumbnail.mockRejectedValue(new Error('Fetch failed'));

      renderWithTheme(<VideoPreview metadata={baseMetadata} />);

      // After rejection, loading should stop and placeholder should show
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).toBeNull();
      });

      // Should show VideocamIcon placeholder (no thumbnail image)
      expect(screen.getByTestId('VideocamIcon')).toBeDefined();
      expect(screen.getByText('test-video.mp4')).toBeDefined();
    });

    it('should not update state after unmount (cancelled flag)', async () => {
      // Create a controllable promise
      let resolveThumb!: (url: string) => void;
      mockFetchThumbnail.mockReturnValue(
        new Promise<string>((resolve) => {
          resolveThumb = resolve;
        }),
      );

      const { unmount } = renderWithTheme(
        <VideoPreview metadata={baseMetadata} />,
      );

      // Unmount before the thumbnail resolves
      unmount();

      // Resolve after unmount - should not throw or cause state update warning
      resolveThumb('blob:too-late');

      // If we get here without error, the cancelled flag worked
    });

    it('should show video controls when playing', () => {
      renderWithTheme(<VideoPreview metadata={baseMetadata} />);

      fireEvent.click(screen.getByTestId('PlayArrowIcon'));

      const video = document.querySelector('video');
      expect(video).not.toBeNull();
      expect(video?.hasAttribute('controls')).toBe(true);
    });

    it('should use useVideoUrl hook for the video src', () => {
      renderWithTheme(<VideoPreview metadata={baseMetadata} />);

      fireEvent.click(screen.getByTestId('PlayArrowIcon'));

      // src is set imperatively (no src prop), so assert the DOM property
      const video = document.querySelector('video');
      expect(video?.src).toBe(
        'http://localhost:3000/api/file/video-123',
      );
    });
  });

  describe('signed URL refresh', () => {
    function renderPlaying() {
      const result = renderWithTheme(<VideoPreview metadata={baseMetadata} />);
      fireEvent.click(screen.getByTestId('PlayArrowIcon'));
      const video = document.querySelector('video') as HTMLVideoElement;
      expect(video).not.toBeNull();
      expect(playMock).toHaveBeenCalledTimes(1);
      return { ...result, video };
    }

    function refreshUrl(
      rerender: (ui: React.ReactElement) => void,
      url = 'http://localhost:3000/api/file/video-123?sig=refreshed',
    ) {
      videoUrlMock.urlOverride = url;
      rerender(
        <ThemeProvider theme={theme}>
          <VideoPreview metadata={baseMetadata} />
        </ThemeProvider>,
      );
    }

    it('should not replay when the URL refreshes while paused, and restores currentTime', () => {
      const { rerender, video } = renderPlaying();

      // jsdom default: video.paused === true
      video.currentTime = 42;

      refreshUrl(rerender);
      expect(video.src).toContain('sig=refreshed');

      fireEvent(video, new Event('loadedmetadata'));

      expect(playMock).toHaveBeenCalledTimes(1); // no additional play()
      expect(video.currentTime).toBe(42);
    });

    it('should not resume playback after a URL refresh when the document is hidden', () => {
      const { rerender, video } = renderPlaying();

      Object.defineProperty(video, 'paused', {
        value: false,
        configurable: true,
      });
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });

      refreshUrl(rerender);
      fireEvent(video, new Event('loadedmetadata'));

      expect(playMock).toHaveBeenCalledTimes(1); // only the initial user-gesture play
    });

    it('should resume playback after a URL refresh when the document is visible', () => {
      const { rerender, video } = renderPlaying();

      Object.defineProperty(video, 'paused', {
        value: false,
        configurable: true,
      });
      // visibilityState is 'visible' (set in beforeEach)

      refreshUrl(rerender);
      fireEvent(video, new Event('loadedmetadata'));

      expect(playMock).toHaveBeenCalledTimes(2);
    });
  });
});
