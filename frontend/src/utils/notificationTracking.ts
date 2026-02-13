/**
 * Module-scoped notification tracking state.
 * These are ephemeral, non-reactive flags — no context or reactivity needed.
 */

let permissionRequested = false;
const shownIds = new Set<string>();

export function isPermissionRequested(): boolean {
  return permissionRequested;
}

export function setPermissionRequested(value: boolean): void {
  permissionRequested = value;
}

export function isNotificationShown(id: string): boolean {
  return shownIds.has(id);
}

export function markNotificationAsShown(id: string): void {
  shownIds.add(id);
}
