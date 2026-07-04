import { describe, it, expect } from 'vitest';
import { isDndActive, type ClientDndSettings } from '../../utils/dnd';

const base: ClientDndSettings = {
  doNotDisturb: true,
  dndStartTime: null,
  dndEndTime: null,
};

// Local-time dates (client DND evaluates against the device clock)
const at = (hours: number, minutes = 0) => new Date(2026, 6, 3, hours, minutes);

describe('isDndActive (client)', () => {
  it('returns false when DND is off', () => {
    expect(isDndActive({ ...base, doNotDisturb: false }, at(12))).toBe(false);
  });

  it('returns true for manual DND with no time window', () => {
    expect(isDndActive(base, at(12))).toBe(true);
  });

  it('returns true for malformed times (fails closed to manual toggle)', () => {
    expect(isDndActive({ ...base, dndStartTime: 'bogus', dndEndTime: '08:00' }, at(12))).toBe(true);
  });

  describe('same-day window', () => {
    const window = { ...base, dndStartTime: '09:00', dndEndTime: '17:00' };

    it('is active inside the window', () => {
      expect(isDndActive(window, at(12, 30))).toBe(true);
    });

    it('is inactive outside the window', () => {
      expect(isDndActive(window, at(8, 59))).toBe(false);
      expect(isDndActive(window, at(18, 0))).toBe(false);
    });

    it('start is inclusive, end is exclusive', () => {
      expect(isDndActive(window, at(9, 0))).toBe(true);
      expect(isDndActive(window, at(17, 0))).toBe(false);
    });
  });

  describe('overnight window', () => {
    const overnight = { ...base, dndStartTime: '22:00', dndEndTime: '08:00' };

    it('is active late at night and early morning', () => {
      expect(isDndActive(overnight, at(23, 30))).toBe(true);
      expect(isDndActive(overnight, at(3, 0))).toBe(true);
    });

    it('is inactive during the day', () => {
      expect(isDndActive(overnight, at(12, 0))).toBe(false);
    });
  });

  it('treats a degenerate window (start === end) as all-day DND', () => {
    expect(isDndActive({ ...base, dndStartTime: '10:00', dndEndTime: '10:00' }, at(15))).toBe(true);
  });
});
