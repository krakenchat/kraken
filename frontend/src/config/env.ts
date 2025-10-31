/**
 * Environment configuration for frontend
 * Provides configurable URLs for API and WebSocket connections
 */

/**
 * Get the base API URL from environment variables or fallback to default
 * In production Electron builds, this should point to the backend server
 */
export const getApiBaseUrl = (): string => {
  // Try to get from environment variable first
  const envUrl = import.meta.env.VITE_API_URL;

  if (envUrl) {
    return envUrl;
  }

  // Check for Electron saved backend URL
  if (typeof window !== 'undefined' && (window as Window & { electronAPI?: unknown }).electronAPI) {
    const savedUrl = localStorage.getItem('electron:backendUrl');
    if (savedUrl) {
      return `${savedUrl}/api`;
    }
  }

  // In development or if not set, use relative path (works with Vite proxy)
  return '/api';
};

/**
 * Get the WebSocket URL from environment variables or fallback to default
 * In production Electron builds, this should point to the backend server
 */
export const getWebSocketUrl = (): string => {
  // Try to get from environment variable first
  const envUrl = import.meta.env.VITE_WS_URL;

  if (envUrl) {
    return envUrl;
  }

  // Check for Electron saved backend URL
  if (typeof window !== 'undefined' && (window as Window & { electronAPI?: unknown }).electronAPI) {
    const savedUrl = localStorage.getItem('electron:backendUrl');
    if (savedUrl) {
      return savedUrl;
    }
    // Fallback to localhost if no saved URL
    return 'http://localhost:3000';
  }

  // In browser development, try to use current host
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  // Final fallback
  return 'http://localhost:3000';
};

/**
 * Get full API endpoint URL
 * @param path - API endpoint path (e.g., '/auth/login')
 */
export const getApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};
