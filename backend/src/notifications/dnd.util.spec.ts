import { isDndActive, DndSettings } from './dnd.util';

const base: DndSettings = {
  doNotDisturb: true,
  dndStartTime: null,
  dndEndTime: null,
  dndTimezone: null,
};

// Fixed instant: 2026-07-03T12:30:00Z
const NOON_UTC = new Date('2026-07-03T12:30:00Z');

describe('isDndActive', () => {
  it('returns false when DND is off', () => {
    expect(isDndActive({ ...base, doNotDisturb: false }, NOON_UTC)).toBe(false);
  });

  it('returns true for manual DND with no time window', () => {
    expect(isDndActive(base, NOON_UTC)).toBe(true);
  });

  it('returns true when only one bound is set (treated as manual toggle)', () => {
    expect(isDndActive({ ...base, dndStartTime: '22:00' }, NOON_UTC)).toBe(
      true,
    );
    expect(isDndActive({ ...base, dndEndTime: '08:00' }, NOON_UTC)).toBe(true);
  });

  it('returns true for malformed times (fails closed to manual toggle)', () => {
    expect(
      isDndActive(
        { ...base, dndStartTime: '25:99', dndEndTime: '08:00' },
        NOON_UTC,
      ),
    ).toBe(true);
  });

  describe('same-day window (UTC)', () => {
    const window = { ...base, dndStartTime: '09:00', dndEndTime: '17:00' };

    it('is active inside the window', () => {
      expect(isDndActive(window, NOON_UTC)).toBe(true);
    });

    it('is inactive outside the window', () => {
      expect(isDndActive(window, new Date('2026-07-03T18:30:00Z'))).toBe(false);
      expect(isDndActive(window, new Date('2026-07-03T08:59:00Z'))).toBe(false);
    });

    it('start is inclusive, end is exclusive', () => {
      expect(isDndActive(window, new Date('2026-07-03T09:00:00Z'))).toBe(true);
      expect(isDndActive(window, new Date('2026-07-03T17:00:00Z'))).toBe(false);
    });
  });

  describe('overnight window (UTC)', () => {
    const overnight = { ...base, dndStartTime: '22:00', dndEndTime: '08:00' };

    it('is active late at night and early morning', () => {
      expect(isDndActive(overnight, new Date('2026-07-03T23:30:00Z'))).toBe(
        true,
      );
      expect(isDndActive(overnight, new Date('2026-07-03T03:00:00Z'))).toBe(
        true,
      );
    });

    it('is inactive during the day', () => {
      expect(isDndActive(overnight, NOON_UTC)).toBe(false);
    });
  });

  describe('timezone handling', () => {
    it('evaluates the window in the stored timezone', () => {
      // 12:30 UTC = 21:30 in Tokyo (UTC+9): inside a 21:00-23:00 window there
      const settings = {
        ...base,
        dndStartTime: '21:00',
        dndEndTime: '23:00',
        dndTimezone: 'Asia/Tokyo',
      };
      expect(isDndActive(settings, NOON_UTC)).toBe(true);
      // ...but not in UTC
      expect(isDndActive({ ...settings, dndTimezone: null }, NOON_UTC)).toBe(
        false,
      );
    });

    it('falls back to UTC for an invalid timezone instead of throwing', () => {
      const settings = {
        ...base,
        dndStartTime: '09:00',
        dndEndTime: '17:00',
        dndTimezone: 'Not/AZone',
      };
      expect(isDndActive(settings, NOON_UTC)).toBe(true);
    });
  });

  it('treats a degenerate window (start === end) as all-day DND', () => {
    expect(
      isDndActive(
        { ...base, dndStartTime: '10:00', dndEndTime: '10:00' },
        NOON_UTC,
      ),
    ).toBe(true);
  });
});
