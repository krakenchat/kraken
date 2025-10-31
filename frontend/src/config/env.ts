/**
 * Environment configuration for frontend
 * Provides configurable URLs for API and WebSocket connections
 */

import { getActiveServer } from '../utils/serverStorage';

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

  // Check for Electron active server
  if (typeof window !== 'undefined' && (window as Window & { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron) {
    const activeServer = getActiveServer();
    if (activeServer) {
      return `${activeServer.url}/api`;
    }
  }

  // In browser development, use relative path (works with Vite proxy)
  if (typeof window !== 'undefined' && window.location) {
    return '/api';
  }

  // Final fallback
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

  // Check for Electron active server
  if (typeof window !== 'undefined' && (window as Window & { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron) {
    const activeServer = getActiveServer();
    if (activeServer) {
      return activeServer.url;
    }
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
