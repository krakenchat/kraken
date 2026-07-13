/**
 * Shared types for the secure-storage IPC surface (main <-> preload).
 *
 * Kept in a standalone module (rather than only in main.ts) so preload.ts —
 * which is compiled independently via a raw `tsc` invocation, not a
 * tsconfig project — can import the same types without pulling in main.ts.
 */

/**
 * Whether the OS keychain (via Electron's `safeStorage`) is available for
 * encrypting values on this system. `'unavailable'` typically means no
 * OS-level credential store is present (e.g. a Linux desktop without a
 * keyring daemon), so secrets can't be encrypted at rest.
 */
export type SecureStorageAvailability = 'available' | 'unavailable';

/**
 * Result of a `secure-storage:store` IPC call. Replaces the previous
 * `true | null` contract, which conflated "encryption unavailable" with
 * "write failed" and gave the renderer no way to tell the two apart.
 */
export interface SecureStorageStoreResult {
  /** Whether the value was successfully encrypted and written to disk. */
  stored: boolean;
  /** Encryption availability at the time of this call. */
  availability: SecureStorageAvailability;
}
