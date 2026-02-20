import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { PublicRoute } from '../../components/PublicRoute';
import { Route, Routes } from 'react-router-dom';

vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), dev: vi.fn(), info: vi.fn(), debug: vi.fn() },
  default: { warn: vi.fn(), error: vi.fn(), dev: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

/** Helper: create a fake JWT with a given exp */
function makeJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ exp, sub: 'user1' }));
  return `${header}.${body}.fakesig`;
}

function validToken() {
  return makeJwt(Math.floor(Date.now() / 1000) + 3600);
}

function expiredToken() {
  return makeJwt(Math.floor(Date.now() / 1000) - 60);
}

function renderPublicRoute(initialRoute = '/login') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <div data-testid="login-form">Login Form</div>
          </PublicRoute>
        }
      />
      <Route path="/" element={<div data-testid="home">Home</div>} />
    </Routes>,
    { routerProps: { initialEntries: [initialRoute] } },
  );
}

describe('PublicRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders children when no token is present', () => {
    renderPublicRoute();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
  });

  it('renders children when token is expired', () => {
    localStorage.setItem('accessToken', expiredToken());
    renderPublicRoute();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
  });

  it('renders children when token is expiring within the 30s buffer', () => {
    const soonExp = Math.floor(Date.now() / 1000) + 10;
    localStorage.setItem('accessToken', makeJwt(soonExp));
    renderPublicRoute();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });

  it('redirects to / when user has a valid (non-expired) token', () => {
    localStorage.setItem('accessToken', validToken());
    renderPublicRoute();
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
  });

  it('renders children when token is malformed (not a JWT)', () => {
    localStorage.setItem('accessToken', 'not-a-jwt');
    renderPublicRoute();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });

  it('handles legacy JSON-encoded token format — redirects if valid', () => {
    // Legacy format: JSON.stringify(token) wraps the JWT in quotes
    localStorage.setItem('accessToken', JSON.stringify(validToken()));
    renderPublicRoute();
    // getAccessToken() unwraps the JSON, isTokenExpired checks inner JWT
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('handles legacy { value: token } format — redirects if valid', () => {
    localStorage.setItem('accessToken', JSON.stringify({ value: validToken() }));
    renderPublicRoute();
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });
});
