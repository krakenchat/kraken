/**
 * Telemetry Service - OpenObserve RUM & Logs integration
 *
 * Captures frontend errors, performance metrics, and session replays
 * for debugging user issues.
 *
 * Configuration via environment variables:
 * - VITE_TELEMETRY_ENDPOINT: OpenObserve server URL
 * - VITE_TELEMETRY_CLIENT_TOKEN: Authentication token from OpenObserve
 * - VITE_TELEMETRY_ORG_ID: Organization identifier (default: 'default')
 */

import { openobserveRum } from '@openobserve/browser-rum';
import { openobserveLogs } from '@openobserve/browser-logs';

let initialized = false;

/**
 * Initialize telemetry collection.
 * Should be called once at app startup, before React renders.
 * Silently skips if required environment variables are not set.
 */
export function initTelemetry(): void {
  const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT;
  const clientToken = import.meta.env.VITE_TELEMETRY_CLIENT_TOKEN;
  const orgId = import.meta.env.VITE_TELEMETRY_ORG_ID || 'default';

  if (!endpoint || !clientToken) {
    // Telemetry not configured - this is expected in development
    return;
  }

  if (initialized) return;
  initialized = true;

  try {
    // Initialize RUM (Real User Monitoring)
    openobserveRum.init({
      applicationId: 'kraken-frontend',
      clientToken,
      site: endpoint,
      organizationIdentifier: orgId,
      service: 'kraken-frontend',
      env: import.meta.env.MODE,
      version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      apiVersion: 'v1',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 100,
      trackResources: true,
      trackLongTasks: true,
      trackUserInteractions: true,
      defaultPrivacyLevel: 'mask-user-input',
    });

    // Initialize Logs
    openobserveLogs.init({
      clientToken,
      site: endpoint,
      organizationIdentifier: orgId,
      service: 'kraken-frontend',
      env: import.meta.env.MODE,
      apiVersion: 'v1',
      forwardErrorsToLogs: true,
      forwardConsoleLogs: ['error', 'warn'],
    });

    // Start session recording for replay functionality
    openobserveRum.startSessionReplayRecording();
  } catch (error) {
    console.error('Failed to initialize telemetry:', error);
  }
}

/**
 * Set user context for telemetry.
 * Call after successful login to associate errors with users.
 */
export function setTelemetryUser(user: {
  id: string;
  username: string;
  email?: string;
}): void {
  if (!initialized) return;

  try {
    openobserveRum.setUser({
      id: user.id,
      name: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error('Failed to set telemetry user:', error);
  }
}

/**
 * Clear user context from telemetry.
 * Call on logout to stop associating events with the previous user.
 */
export function clearTelemetryUser(): void {
  if (!initialized) return;

  try {
    openobserveRum.clearUser();
  } catch (error) {
    console.error('Failed to clear telemetry user:', error);
  }
}

/**
 * Manually track an error with optional context.
 * Use for caught exceptions that should still be reported.
 */
export function trackError(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (!initialized) return;

  try {
    openobserveLogs.logger.error(error.message, {
      error: {
        kind: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    });
  } catch (e) {
    console.error('Failed to track error:', e);
  }
}

/**
 * Track network/API errors with request details.
 * Use in API base query error handlers.
 */
export function trackNetworkError(
  endpoint: string,
  status: number,
  errorData: unknown
): void {
  if (!initialized) return;

  try {
    openobserveLogs.logger.error(`API Error: ${status} ${endpoint}`, {
      endpoint,
      status,
      error: errorData instanceof Error ? errorData.message : String(errorData),
      type: 'network_error',
    });
  } catch (e) {
    console.error('Failed to track network error:', e);
  }
}

/**
 * Add custom context to all subsequent telemetry events.
 * Useful for adding community ID, channel ID, etc.
 */
export function addTelemetryContext(context: Record<string, unknown>): void {
  if (!initialized) return;

  try {
    openobserveRum.addRumGlobalContext(
      Object.keys(context)[0],
      Object.values(context)[0]
    );
  } catch (error) {
    console.error('Failed to add telemetry context:', error);
  }
}
