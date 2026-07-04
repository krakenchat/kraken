import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { OfflineBanner } from '../../components/PWA/OfflineBanner';

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    setOnLine(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setOnLine(true);
  });

  it('is hidden while online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
  });

  it('appears on the offline event', () => {
    render(<OfflineBanner />);

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it('disappears again on the online event', async () => {
    render(<OfflineBanner />);

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText("You're offline")).toBeInTheDocument();

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() =>
      expect(screen.queryByText("You're offline")).not.toBeInTheDocument(),
    );
  });

  it('starts visible when the app loads already offline', () => {
    setOnLine(false);
    render(<OfflineBanner />);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });
});
