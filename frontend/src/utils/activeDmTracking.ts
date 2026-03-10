/**
 * Module-scoped tracker for the currently viewed DM group.
 *
 * DirectMessagesPage syncs its selectedDmGroupId state here so that
 * useNotificationSideEffects can reliably check whether the user is
 * viewing a specific DM conversation (the URL ?group= param is cleared
 * immediately after use, making it unreliable for suppression checks).
 */

let activeDmGroupId: string | null = null;

export function setActiveDmGroupId(id: string | null): void {
  activeDmGroupId = id;
}

export function getActiveDmGroupId(): string | null {
  return activeDmGroupId;
}
