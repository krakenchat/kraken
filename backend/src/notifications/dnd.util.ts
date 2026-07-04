/**
 * Do-Not-Disturb window evaluation.
 *
 * DND suppresses *delivery side effects* (push notifications server-side,
 * sounds/desktop notifications client-side) — never notification record
 * creation or WebSocket emission, which unread counts depend on.
 */

export interface DndSettings {
  doNotDisturb: boolean;
  /** "HH:mm" 24-hour wall-clock in the user's timezone */
  dndStartTime: string | null;
  /** "HH:mm" 24-hour wall-clock in the user's timezone */
  dndEndTime: string | null;
  /**
   * IANA timezone the times are expressed in. Sent by the client when DND
   * settings are saved; may be stale if the user travels without
   * re-saving. Null/invalid falls back to server-UTC evaluation.
   */
  dndTimezone: string | null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes since midnight for an "HH:mm" string, or null if malformed. */
function parseTime(value: string | null): number | null {
  if (!value || !TIME_PATTERN.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Current minutes-since-midnight in the given timezone (UTC fallback). */
function currentMinutesIn(timezone: string | null, now: Date): number {
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone ?? 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    // Invalid IANA name — evaluate in UTC rather than failing delivery
    formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  }
  const [hours, minutes] = formatted.split(':').map(Number);
  // Intl can emit "24:xx" for midnight in some environments
  return (hours % 24) * 60 + minutes;
}

/**
 * Whether the user's Do-Not-Disturb is in effect right now.
 *
 * - DND off → false
 * - DND on with no (or malformed) time window → true (manual toggle)
 * - DND on with window → true iff the user-local wall-clock time is inside
 *   it; overnight windows (start > end, e.g. 22:00–08:00) wrap midnight.
 */
export function isDndActive(
  settings: DndSettings,
  now: Date = new Date(),
): boolean {
  if (!settings.doNotDisturb) {
    return false;
  }

  const start = parseTime(settings.dndStartTime);
  const end = parseTime(settings.dndEndTime);
  if (start === null || end === null) {
    return true;
  }

  const current = currentMinutesIn(settings.dndTimezone, now);
  if (start === end) {
    // Degenerate window — treat as all-day DND
    return true;
  }
  if (start > end) {
    // Overnight window, e.g. 22:00 → 08:00
    return current >= start || current < end;
  }
  return current >= start && current < end;
}
