/**
 * Centralized Token Refresh Service
 *
 * This service provides a single source of truth for token refresh operations,
 * preventing race conditions and ensuring consistent auth state across HTTP and WebSocket.
 */

import axios from "axios";
import { getApiUrl } from "../config/env";
import { setCachedItem, getCachedItem, removeCachedItem } from "./storage";
import { isElectron } from "./platform";
import { logger } from "./logger";

// Event emitter for token refresh notifications
type TokenRefreshListener = (newToken: string) => void;
const listeners: Set<TokenRefreshListener> = new Set();

// Mutex for preventing concurrent refresh attempts
let refreshPromise: Promise<string | null> | null = null;
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 1;

/**
 * Get the current access token
 */
export function getAccessToken(): string | null {
  return getCachedItem("accessToken");
}

/**
 * Set the access token
 */
export function setAccessToken(token: string): void {
  setCachedItem("accessToken", token);
}

/**
 * Clear all auth tokens
 */
export function clearTokens(): void {
  removeCachedItem("accessToken");
  localStorage.removeItem("refreshToken");
}

/**
 * Subscribe to token refresh events
 * @returns Unsubscribe function
 */
export function onTokenRefreshed(listener: TokenRefreshListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notify all listeners of a token refresh
 */
function notifyTokenRefreshed(newToken: string): void {
  listeners.forEach((listener) => {
    try {
      listener(newToken);
    } catch (error) {
      logger.error("[TokenService] Error in token refresh listener:", error);
    }
  });
}

/**
 * Perform the actual token refresh
 */
async function performRefresh(): Promise<string | null> {
  const isElectronApp = isElectron();

  try {
    let refreshResponse;

    if (isElectronApp) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        throw new Error("No refresh token available for Electron client");
      }

      // For Electron, send refresh token in body
      refreshResponse = await axios.post<{
        accessToken: string;
        refreshToken?: string;
      }>(getApiUrl("/auth/refresh"), { refreshToken });
    } else {
      // For web clients, use cookie-based refresh
      refreshResponse = await axios.post<{ accessToken: string }>(
        getApiUrl("/auth/refresh"),
        {},
        { withCredentials: true }
      );
    }

    if (refreshResponse?.data?.accessToken) {
      const newToken = refreshResponse.data.accessToken;
      setAccessToken(newToken);

      // Update stored refresh token for Electron
      if (isElectronApp && refreshResponse.data.refreshToken) {
        localStorage.setItem("refreshToken", refreshResponse.data.refreshToken);
      }

      logger.dev("[TokenService] Token refreshed successfully");
      notifyTokenRefreshed(newToken);
      return newToken;
    }

    throw new Error("No access token in refresh response");
  } catch (error) {
    logger.error("[TokenService] Token refresh failed:", error);
    throw error;
  }
}

/**
 * Refresh the access token
 *
 * This function is idempotent - concurrent calls will share the same refresh promise,
 * preventing multiple simultaneous refresh requests.
 *
 * @returns The new access token, or null if refresh failed
 */
export async function refreshToken(): Promise<string | null> {
  // If we've exceeded max attempts, don't try again
  if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
    logger.dev("[TokenService] Max refresh attempts exceeded");
    return null;
  }

  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    logger.dev("[TokenService] Refresh already in progress, waiting...");
    return refreshPromise;
  }

  // Start a new refresh
  refreshAttempts++;
  logger.dev("[TokenService] Starting token refresh");

  refreshPromise = performRefresh()
    .then((token) => {
      // Reset attempts on success
      refreshAttempts = 0;
      return token;
    })
    .catch((error) => {
      logger.error("[TokenService] Refresh failed:", error);
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * Reset the refresh attempt counter
 * Call this when the user successfully authenticates
 */
export function resetRefreshAttempts(): void {
  refreshAttempts = 0;
}

/**
 * Check if a token refresh is currently in progress
 */
export function isRefreshing(): boolean {
  return refreshPromise !== null;
}

/**
 * Redirect to login page
 */
export function redirectToLogin(): void {
  clearTokens();
  resetRefreshAttempts();
  // Use hash for HashRouter compatibility (especially in Electron)
  if (window.location.hash !== "#/login") {
    window.location.hash = "#/login";
  }
}
