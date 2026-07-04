/**
 * Client-side Do-Not-Disturb evaluation.
 *
 * Mirrors backend/src/notifications/dnd.util.ts, but evaluates against the
 * device's local wall clock (no timezone plumbing needed — the user's DND
 * window is defined in their own local time).
 *
 * DND suppresses delivery side effects only (sounds, desktop
 * notifications) — never cache updates or unread badges.
 */

export interface ClientDndSettings {
  doNotDisturb: boolean;
  dndStartTime: string | null;
  dndEndTime: string | null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseTime(value: string | null): number | null {
  if (!value || !TIME_PATTERN.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Whether DND is in effect right now, in device-local time.
 * - DND off → false
 * - DND on with no/malformed window → true (manual toggle)
 * - Overnight windows (start > end, e.g. 22:00–08:00) wrap midnight.
 */
export function isDndActive(settings: ClientDndSettings, now: Date = new Date()): boolean {
  if (!settings.doNotDisturb) {
    return false;
  }

  const start = parseTime(settings.dndStartTime);
  const end = parseTime(settings.dndEndTime);
  if (start === null || end === null) {
    return true;
  }

  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) {
    // Degenerate window — treat as all-day DND
    return true;
  }
  if (start > end) {
    return current >= start || current < end;
  }
  return current >= start && current < end;
}
