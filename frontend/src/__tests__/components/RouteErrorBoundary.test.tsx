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

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    bomb.shouldThrow = true;
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
});
