import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { AppErrorFallback } from '../../components/AppErrorFallback';

function Bomb(): never {
  throw new Error('Catastrophic failure');
}

describe('AppErrorFallback (app-level ErrorBoundary usage)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the full-page fallback with the error message and a Reload button when a child throws', () => {
    // Mirrors how App.tsx wires the app-level boundary:
    // <ErrorBoundary fallback={(error) => <AppErrorFallback error={error} />}>
    renderWithProviders(
      <ErrorBoundary fallback={(error) => <AppErrorFallback error={error} />}>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText('Catastrophic failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('calls window.location.reload when the Reload button is clicked', async () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    // jsdom's window.location.reload is not implemented; stub it out.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    const { user } = renderWithProviders(
      <ErrorBoundary fallback={(error) => <AppErrorFallback error={error} />}>
        <Bomb />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: /reload/i }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
