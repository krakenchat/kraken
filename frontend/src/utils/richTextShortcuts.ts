/**
 * Helpers for composer rich-text keyboard shortcuts (Ctrl/Cmd+B, Ctrl/Cmd+I).
 *
 * These operate purely on the textarea string + selection so they can be unit
 * tested without a DOM, and are shared by the channel and thread composers.
 */

export interface WrapResult {
  newText: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Wrap the current selection with a markdown marker (e.g. `**` or `_`). If the
 * selection is already wrapped by the same marker it is unwrapped (toggle). With
 * an empty selection an empty marker pair is inserted and the caret placed
 * between the markers so the user can type.
 */
export function wrapSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  marker: string
): WrapResult {
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  // Toggle off: the markers sit just outside the selection.
  if (before.endsWith(marker) && after.startsWith(marker)) {
    const newText =
      before.slice(0, before.length - marker.length) +
      selected +
      after.slice(marker.length);
    const start = selectionStart - marker.length;
    return { newText, selectionStart: start, selectionEnd: start + selected.length };
  }

  // Toggle off: the markers are inside the selection.
  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length >= marker.length * 2
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return {
      newText: before + inner + after,
      selectionStart,
      selectionEnd: selectionStart + inner.length,
    };
  }

  // Wrap on.
  const newText = before + marker + selected + marker + after;
  const start = selectionStart + marker.length;
  return { newText, selectionStart: start, selectionEnd: start + selected.length };
}

/** Map a keyboard event to its formatting marker, or null. */
export function markerForShortcut(key: string): string | null {
  switch (key.toLowerCase()) {
    case 'b':
      return '**';
    case 'i':
      return '_';
    default:
      return null;
  }
}
