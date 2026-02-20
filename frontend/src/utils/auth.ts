/**
 * Authentication Utilities — Re-export shim
 *
 * All token logic now lives in tokenService.ts. This module re-exports under
 * the old names so existing consumers continue to work without modification.
 */

export {
  getAccessToken as getAuthToken,
  setAccessToken as setAuthToken,
  clearTokens as clearAuthToken,
  getAuthenticatedUrl,
} from "./tokenService";

import { getAccessToken } from "./tokenService";

/**
 * Check if user is authenticated (has a token in storage).
 *
 * Note: This only checks for token presence, not validity.
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
