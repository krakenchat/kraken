/**
 * Service-worker update coordination.
 *
 * `registerSW` runs in main.tsx, outside the React tree, so we need a small
 * module-level store to bridge the "an update is waiting" signal into a React
 * component (UpdateToast). It holds:
 *   - the `updateSW` callback returned by registerSW (calling it with `true`
 *     posts SKIP_WAITING to the waiting SW and reloads once it activates),
 *   - an `updateAvailable` flag set from registerSW's `onNeedRefresh`,
 *   - a `deferred` flag the voice layer raises while the user is in a call so
 *     we never reload mid-call.
 *
 * UpdateToast subscribes via useSyncExternalStore and shows only when an update
 * is available AND not deferred.
 */

type UpdateSWFn = (reloadPage?: boolean) => Promise<void>;
type Listener = () => void;

let updateSW: UpdateSWFn | null = null;
let updateAvailable = false;
let deferred = false;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Register the callback returned by vite-plugin-pwa's registerSW. */
export function setUpdateSW(fn: UpdateSWFn): void {
  updateSW = fn;
}

/** Mark that a new service worker is waiting (registerSW onNeedRefresh). */
export function setUpdateAvailable(value: boolean): void {
  if (updateAvailable === value) return;
  updateAvailable = value;
  notify();
}

/**
 * Defer the update prompt (e.g. while in a voice call). When cleared, a
 * previously-suppressed prompt reappears without needing a fresh SW event.
 */
export function setUpdateDeferred(value: boolean): void {
  if (deferred === value) return;
  deferred = value;
  notify();
}

export function isUpdateAvailable(): boolean {
  return updateAvailable;
}

export function isUpdateDeferred(): boolean {
  return deferred;
}

/** True only when an update is waiting and it isn't currently deferred. */
export function shouldShowUpdate(): boolean {
  return updateAvailable && !deferred;
}

/**
 * Apply the waiting update: triggers skipWaiting + reload. No-op if registerSW
 * hasn't wired a callback yet (e.g. Electron, or before registration).
 */
export async function applyUpdate(): Promise<void> {
  if (updateSW) {
    await updateSW(true);
  }
}

/** Subscribe to store changes. Returns an unsubscribe fn. */
export function subscribeSwUpdate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: reset all module state. */
export function _resetSwUpdateForTests(): void {
  updateSW = null;
  updateAvailable = false;
  deferred = false;
  listeners.clear();
}
