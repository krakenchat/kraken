import { describe, it, expect } from 'vitest';
import { stringToColor, getCommunityInitials } from '../../utils/communityHelpers';

describe('stringToColor', () => {
  it('returns an object with bg and text properties', () => {
    const result = stringToColor('Test Community');
    expect(result).toHaveProperty('bg');
    expect(result).toHaveProperty('text');
  });

  it('returns a valid HSL string for bg', () => {
    const result = stringToColor('My Server');
    expect(result.bg).toMatch(/^hsl\(\d{1,3}, 65%, 45%\)$/);
  });

  it('always returns #ffffff for text', () => {
    expect(stringToColor('Alpha').text).toBe('#ffffff');
    expect(stringToColor('Beta').text).toBe('#ffffff');
    expect(stringToColor('').text).toBe('#ffffff');
  });

  it('is deterministic (same input produces same output)', () => {
    const first = stringToColor('Deterministic');
    const second = stringToColor('Deterministic');
    expect(first).toEqual(second);
  });

  it('generally produces different colors for different inputs', () => {
    const a = stringToColor('Community Alpha');
    const b = stringToColor('Community Beta');
    expect(a.bg).not.toBe(b.bg);
  });

  it('handles an empty string without throwing', () => {
    const result = stringToColor('');
    expect(result.bg).toMatch(/^hsl\(\d{1,3}, 65%, 45%\)$/);
  });
});

describe('getCommunityInitials', () => {
  it('returns the first letter uppercase for a single word', () => {
    expect(getCommunityInitials('Gaming')).toBe('G');
  });

  it('returns first letter of each word for two words', () => {
    expect(getCommunityInitials('Game Night')).toBe('GN');
  });

  it('only uses the first two words for three or more words', () => {
    expect(getCommunityInitials('My Cool Server')).toBe('MC');
    expect(getCommunityInitials('A B C D E')).toBe('AB');
  });

  it('returns an empty string for an empty string', () => {
    expect(getCommunityInitials('')).toBe('');
  });

  it('uppercases lowercase letters', () => {
    expect(getCommunityInitials('hello world')).toBe('HW');
  });
});
