/**
 * Authentication Utilities
 *
 * Centralized authentication token management to eliminate code duplication
 * across contexts, hooks, and API layers.
 */

import { logger } from './logger';

/**
 * Get the authentication token from localStorage
 *
 * Handles both JSON-encoded and plain string token formats for backwards compatibility.
 * This consolidates the duplicated token parsing logic found in:
 * - contexts/AvatarCacheContext.tsx
 * - hooks/useFileUpload.ts
 * - features/AuthedBaseQuery.ts
 * - utils/socketSingleton.ts
 *
 * @returns The access token string, or null if not found or invalid
 */
export function getAuthToken(): string | null {
  try {
    const tokenRaw = localStorage.getItem('accessToken');

    if (!tokenRaw) {
      return null;
    }

    // Try to parse as JSON first (newer format)
    try {
      const parsed = JSON.parse(tokenRaw);

      // Handle object format: { value: "token" }
      if (parsed && typeof parsed === 'object' && 'value' in parsed) {
        return parsed.value || null;
      }

      // Handle direct string value
      if (typeof parsed === 'string') {
        return parsed;
      }

      // Unexpected format
      logger.warn('[Auth] Unexpected token format in localStorage:', typeof parsed);
      return null;
    } catch {
      // Not JSON - treat as plain string (legacy format)
      return tokenRaw;
    }
  } catch (error) {
    logger.error('[Auth] Error retrieving auth token:', error);
    return null;
  }
}

/**
 * Set the authentication token in localStorage
 *
 * @param token - The token string to store
 */
export function setAuthToken(token: string): void {
  try {
    // Store as plain string for consistency
    localStorage.setItem('accessToken', token);
  } catch (error) {
    logger.error('[Auth] Error storing auth token:', error);
  }
}

/**
 * Remove the authentication token from localStorage
 */
export function clearAuthToken(): void {
  try {
    localStorage.removeItem('accessToken');
  } catch (error) {
    logger.error('[Auth] Error clearing auth token:', error);
  }
}

/**
 * Check if user is authenticated (has a valid token)
 *
 * Note: This only checks for token presence, not validity.
 * Token validity is checked by the backend.
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}
