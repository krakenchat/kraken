/**
 * One-slot "pending deep link" stash.
 *
 * `useDeepLinks` (mounted unconditionally at the top of App.tsx, so it's
 * alive on public routes too) writes here when a deep link needing
 * authentication arrives before the user is signed in. AuthGate — the one
 * place every path into the app funnels through (LoginPage, RegisterPage,
 * JoinInvitePage, onboarding completion, and silent refresh all end with
 * AuthGate observing `Authenticated`) — reads and clears it once its state
 * reaches Authenticated.
 *
 * Latest-wins by design: a second deep link arriving before the user signs
 * in simply overwrites the first. Module-scoped (not React state) since it
 * needs to be written from one hook and read from a different component
 * with no shared parent to lift state into.
 */

import type { DeepLinkRoute } from '../types/electron-api';

let pendingRoute: DeepLinkRoute | null = null;

/** Stash a route, overwriting any previously-stashed (unflushed) one. */
export function stashDeepLinkRoute(route: DeepLinkRoute): void {
  pendingRoute = route;
}

/** Read and clear the stashed route in one step. Returns `null` if none is pending. */
export function takeStashedDeepLinkRoute(): DeepLinkRoute | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}
