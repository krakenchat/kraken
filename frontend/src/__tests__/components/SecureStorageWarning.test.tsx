import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { SecureStorageWarning } from '../../components/Electron/SecureStorageWarning';

const WARNING_TEXT =
  'Secure credential storage is unavailable on this system; your session token will be stored unencrypted.';
const SHOWN_KEY = 'semaphore:secureStorageWarningShown';
const PENDING_KEY = 'semaphore:secureStorageWarningPending';

describe('SecureStorageWarning', () => {
  let originalElectronAPI: typeof window.electronAPI;

  beforeEach(() => {
    originalElectronAPI = window.electronAPI;
    localStorage.clear();
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    localStorage.clear();
  });

  it('does nothing outside Electron (electronAPI.isElectron falsy)', async () => {
    window.electronAPI = undefined;
    localStorage.setItem(PENDING_KEY, 'true');

    renderWithProviders(<SecureStorageWarning />);

    // Give effects a tick to run, then assert no notification appeared and
    // the pending marker is untouched (never consumed outside Electron).
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
    expect(localStorage.getItem(PENDING_KEY)).toBe('true');
  });

  it('shows the warning on mount when a pending marker is present and not dismissed', async () => {
    window.electronAPI = { isElectron: true };
    localStorage.setItem(PENDING_KEY, 'true');

    renderWithProviders(<SecureStorageWarning />);

    await waitFor(() => {
      expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
    });

    // Consuming pending marks the warning as permanently shown and clears
    // the pending marker.
    expect(localStorage.getItem(SHOWN_KEY)).toBe('true');
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('shows nothing on mount when no pending marker exists', async () => {
    window.electronAPI = { isElectron: true };

    renderWithProviders(<SecureStorageWarning />);

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
    expect(localStorage.getItem(SHOWN_KEY)).toBeNull();
  });

  it('shows nothing on mount when already dismissed/shown, even if pending is set', async () => {
    window.electronAPI = { isElectron: true };
    localStorage.setItem(SHOWN_KEY, 'true');
    localStorage.setItem(PENDING_KEY, 'true');

    renderWithProviders(<SecureStorageWarning />);

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
    // Defensively cleared since it's irrelevant once dismissed.
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('pending marker survives across a simulated reload (new mount, same localStorage)', async () => {
    // Simulate the pending marker being set by a pre-mount trigger (e.g.
    // AuthGate's cold-launch silent refresh) on a prior "page load".
    localStorage.setItem(PENDING_KEY, 'true');
    window.electronAPI = { isElectron: true };

    const first = renderWithProviders(<SecureStorageWarning />);
    await waitFor(() => {
      expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
    });
    first.unmount();

    // "Reload": fresh mount, localStorage persists (SHOWN_KEY now set) —
    // should NOT show again.
    const second = renderWithProviders(<SecureStorageWarning />);
    await new Promise((r) => setTimeout(r, 0));
    expect(second.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });
});
