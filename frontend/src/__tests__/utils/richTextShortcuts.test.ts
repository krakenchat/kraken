import { describe, it, expect } from 'vitest';
import { wrapSelection, markerForShortcut } from '../../utils/richTextShortcuts';

describe('markerForShortcut', () => {
  it('maps b -> ** and i -> _ (case-insensitive), null otherwise', () => {
    expect(markerForShortcut('b')).toBe('**');
    expect(markerForShortcut('B')).toBe('**');
    expect(markerForShortcut('i')).toBe('_');
    expect(markerForShortcut('I')).toBe('_');
    expect(markerForShortcut('x')).toBeNull();
  });
});

describe('wrapSelection', () => {
  it('wraps the selected range with the marker', () => {
    // "abc" with "b" selected (1..2)
    const result = wrapSelection('abc', 1, 2, '**');
    expect(result.newText).toBe('a**b**c');
    // selection should stay on "b"
    expect(result.newText.slice(result.selectionStart, result.selectionEnd)).toBe('b');
  });

  it('inserts an empty marker pair and places the caret between them', () => {
    const result = wrapSelection('ab', 1, 1, '**');
    expect(result.newText).toBe('a****b');
    expect(result.selectionStart).toBe(3);
    expect(result.selectionEnd).toBe(3);
  });

  it('toggles off when markers sit just outside the selection', () => {
    // "a**b**c" with "b" selected (3..4)
    const result = wrapSelection('a**b**c', 3, 4, '**');
    expect(result.newText).toBe('abc');
    expect(result.newText.slice(result.selectionStart, result.selectionEnd)).toBe('b');
  });

  it('toggles off when markers are inside the selection', () => {
    // select the whole "**b**" (1..6)
    const result = wrapSelection('a**b**c', 1, 6, '**');
    expect(result.newText).toBe('abc');
    expect(result.newText.slice(result.selectionStart, result.selectionEnd)).toBe('b');
  });
});
