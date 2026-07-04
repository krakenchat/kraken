/**
 * Pure helpers for the push-subscription startup re-sync.
 *
 * When the browser rotates a push subscription (expiry, key change), the
 * `pushsubscriptionchange` SW handler re-subscribes but cannot authenticate to
 * the backend (no JWT in the SW). The reliable path is on next app startup:
 * compare the live subscription endpoint against the last one we successfully
 * synced to the backend, and re-POST if they differ.
 */

/**
 * Decide whether the current push subscription needs to be re-synced to the
 * backend.
 *
 * - No current subscription → nothing to sync (`false`).
 * - Current endpoint differs from the last-synced endpoint (including the case
 *   where nothing has ever been synced) → needs sync (`true`).
 * - Endpoints match → already in sync (`false`).
 */
export function shouldResyncPush(
  currentEndpoint: string | null | undefined,
  lastSyncedEndpoint: string | null | undefined,
): boolean {
  if (!currentEndpoint) {
    return false;
  }
  return currentEndpoint !== lastSyncedEndpoint;
}
