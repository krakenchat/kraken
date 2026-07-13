import { ReactNode, useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Link, Outlet, Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test-utils';
import { RouteErrorBoundary } from '../../components/RouteErrorBoundary';

/** Throws during render while `bomb.shouldThrow` is true. Reset it between
 * tests/renders to simulate fixing the underlying issue. */
const bomb = { shouldThrow: true };

function Bomb() {
  if (bomb.shouldThrow) {
    throw new Error('Boom');
  }
  return <div data-testid="safe-content">Safe content</div>;
}

/** Mimics the real usage: one RouteErrorBoundary wraps an <Outlet />, and
 * different route content renders inside it as the pathname changes. */
function Shell() {
  return (
    <RouteErrorBoundary>
      <Outlet />
    </RouteErrorBoundary>
  );
}

/** Module-level mount counter for the provider-persistence tests below. */
let providerMountCount = 0;

/**
 * Mirrors a real provider (SocketProvider/VoiceProvider/etc.) mounted as an
 * ANCESTOR of RouteErrorBoundary — exactly like Layout.tsx mounts
 * SocketHubProvider/ReplayBufferProvider/etc. above the panel-level
 * RouteErrorBoundary that wraps just `<Outlet />`. Deliberately does NOT
 * render an <Outlet /> itself and is NOT part of the route tree beneath the
 * boundary — it's a plain wrapper, so it can never be part of the subtree
 * that a nested ErrorBoundary swaps out for its fallback. This is the
 * property that matters: components above the boundary must survive both
 * ordinary navigation and a crash-then-recover cycle inside it.
 */
function TrackingProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    providerMountCount += 1;
  }, []);
  return <>{children}</>;
}

/** Composition mirroring the App.tsx / Layout.tsx nesting: a provider sits
 * above RouteErrorBoundary, which wraps <Routes>. */
function AppLikeShell() {
  return (
    <TrackingProvider>
      <Link to="/a" data-testid="go-a">
        Go A
      </Link>
      <Link to="/b" data-testid="go-b">
        Go B
      </Link>
      <Link to="/crash" data-testid="go-crash">
        Go crash
      </Link>
      <RouteErrorBoundary>
        <Routes>
          <Route path="/a" element={<div data-testid="route-a">Route A</div>} />
          <Route path="/b" element={<div data-testid="route-b">Route B</div>} />
          <Route path="/crash" element={<Bomb />} />
        </Routes>
      </RouteErrorBoundary>
    </TrackingProvider>
  );
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    bomb.shouldThrow = true;
    providerMountCount = 0;
    // React logs a console.error for the caught render error (and our
    // ErrorBoundary logs via logger.error, which also calls console.error).
    // This is expected noise for these tests — silence it.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the fallback when a child throws during render', () => {
    renderWithProviders(
      <RouteErrorBoundary>
        <Bomb />
      </RouteErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong loading this page/i)).toBeInTheDocument();
    expect(screen.queryByTestId('safe-content')).not.toBeInTheDocument();
  });

  it('re-renders children when "Try again" is clicked after the throw condition is fixed', async () => {
    const { user } = renderWithProviders(
      <RouteErrorBoundary>
        <Bomb />
      </RouteErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong loading this page/i)).toBeInTheDocument();

    // Fix the underlying issue, then retry.
    bomb.shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByTestId('safe-content')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong loading this page/i)).not.toBeInTheDocument();
  });

  it('resets automatically when navigating to a different pathname', async () => {
    const { user } = renderWithProviders(
      <>
        <Link to="/safe" data-testid="go-safe">
          Go safe
        </Link>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/crash" element={<Bomb />} />
            <Route path="/safe" element={<div data-testid="safe-route">Safe route</div>} />
          </Route>
        </Routes>
      </>,
      { routerProps: { initialEntries: ['/crash'] } },
    );

    expect(screen.getByText(/something went wrong loading this page/i)).toBeInTheDocument();

    await user.click(screen.getByTestId('go-safe'));

    expect(await screen.findByTestId('safe-route')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong loading this page/i)).not.toBeInTheDocument();
  });

  it('does not remount providers above RouteErrorBoundary when navigating between healthy routes', async () => {
    const { user } = renderWithProviders(<AppLikeShell />, {
      routerProps: { initialEntries: ['/a'] },
    });

    expect(screen.getByTestId('route-a')).toBeInTheDocument();
    expect(providerMountCount).toBe(1);

    await user.click(screen.getByTestId('go-b'));

    expect(await screen.findByTestId('route-b')).toBeInTheDocument();
    // Critical regression check: a pathname-keyed boundary would unmount and
    // remount everything beneath it (including RouteErrorBoundary's own
    // children, and — with the old top-level placement wrapping all of
    // <Routes> in App.tsx — every provider mounted inside the route tree) on
    // every single navigation. With no location-derived key, healthy
    // navigation must never touch this provider at all.
    expect(providerMountCount).toBe(1);
  });

  it('recovers from a crashed route via navigation without remounting providers above RouteErrorBoundary', async () => {
    const { user } = renderWithProviders(<AppLikeShell />, {
      routerProps: { initialEntries: ['/a'] },
    });

    expect(screen.getByTestId('route-a')).toBeInTheDocument();
    expect(providerMountCount).toBe(1);

    await user.click(screen.getByTestId('go-crash'));

    expect(await screen.findByText(/something went wrong loading this page/i)).toBeInTheDocument();
    // The crash is caught entirely inside RouteErrorBoundary; the provider
    // above it is an already-committed ancestor and is untouched by it.
    expect(providerMountCount).toBe(1);

    await user.click(screen.getByTestId('go-b'));

    expect(await screen.findByTestId('route-b')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong loading this page/i)).not.toBeInTheDocument();
    // The provider must have survived both the crash and the
    // navigation-triggered reset — it should never have been remounted.
    expect(providerMountCount).toBe(1);
  });
});
