/**
 * Pure keyboard-navigation math for the emoji picker's roving-tabindex grid.
 *
 * The picker renders each category (plus an optional "Custom" section) as
 * its own independent CSS grid of fixed-width columns, one after another in
 * a single scrollable region — there's no `role="tablist"` category switcher
 * to jump between (see EmojiPicker.tsx doc comment for why we didn't add
 * one). This module treats that layout as an ordered list of fixed-column
 * "sections" and computes where focus should land for each arrow/paging key,
 * including moving between sections when navigation runs off the top/bottom/
 * start/end of one.
 *
 * Kept dependency-free (no DOM, no React) so the navigation logic can be
 * unit-tested directly.
 */

export const EMOJI_GRID_COLUMNS = 8;

export interface EmojiGridSection {
  /** Unique key for the section (category name, or the custom-emoji sentinel). */
  key: string;
  /** Number of cells (emojis) in this section. */
  count: number;
}

export interface EmojiGridPosition {
  section: string;
  index: number;
}

export const EMOJI_GRID_NAV_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
] as const;

export type EmojiGridNavKey = (typeof EMOJI_GRID_NAV_KEYS)[number];

export function isEmojiGridNavKey(key: string): key is EmojiGridNavKey {
  return (EMOJI_GRID_NAV_KEYS as readonly string[]).includes(key);
}

function clampToSection(section: EmojiGridSection, index: number): number {
  return Math.max(0, Math.min(index, section.count - 1));
}

/**
 * Computes the next roving-tabindex position for a grid navigation key.
 * Returns `current` unchanged if the key has no effect (e.g. ArrowLeft at
 * the very first cell of the very first section).
 */
export function computeNextEmojiGridPosition(
  key: EmojiGridNavKey,
  current: EmojiGridPosition,
  sections: EmojiGridSection[],
  columns: number = EMOJI_GRID_COLUMNS,
): EmojiGridPosition {
  const sectionIdx = sections.findIndex((s) => s.key === current.section);
  if (sectionIdx === -1 || sections.length === 0) return current;

  const section = sections[sectionIdx];
  const { index } = current;

  switch (key) {
    case 'ArrowRight': {
      if (index + 1 < section.count) return { section: section.key, index: index + 1 };
      const next = sections[sectionIdx + 1];
      return next ? { section: next.key, index: 0 } : current;
    }
    case 'ArrowLeft': {
      if (index - 1 >= 0) return { section: section.key, index: index - 1 };
      const prev = sections[sectionIdx - 1];
      return prev ? { section: prev.key, index: prev.count - 1 } : current;
    }
    case 'ArrowDown': {
      const target = index + columns;
      if (target < section.count) return { section: section.key, index: target };
      const next = sections[sectionIdx + 1];
      if (!next) return current;
      const col = index % columns;
      return { section: next.key, index: clampToSection(next, col) };
    }
    case 'ArrowUp': {
      const target = index - columns;
      if (target >= 0) return { section: section.key, index: target };
      const prev = sections[sectionIdx - 1];
      if (!prev) return current;
      const col = index % columns;
      const lastRowStart = Math.floor((prev.count - 1) / columns) * columns;
      return { section: prev.key, index: clampToSection(prev, lastRowStart + col) };
    }
    case 'Home': {
      const rowStart = Math.floor(index / columns) * columns;
      return { section: section.key, index: rowStart };
    }
    case 'End': {
      const rowStart = Math.floor(index / columns) * columns;
      const rowEnd = Math.min(rowStart + columns - 1, section.count - 1);
      return { section: section.key, index: rowEnd };
    }
    case 'PageDown': {
      const next = sections[sectionIdx + 1];
      return next ? { section: next.key, index: 0 } : current;
    }
    case 'PageUp': {
      const prev = sections[sectionIdx - 1];
      if (prev) return { section: prev.key, index: 0 };
      return index === 0 ? current : { section: section.key, index: 0 };
    }
    default:
      return current;
  }
}
