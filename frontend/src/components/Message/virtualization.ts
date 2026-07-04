/**
 * Message-list virtualization gating.
 *
 * Below this many rendered message nodes we keep the battle-tested,
 * non-virtualized path (`MessageList` + `useBidirectionalScroll`). Only at or
 * above the threshold, and only in normal (non-anchored) mode, do we switch to
 * the virtualized renderer. See docs/message-list-virtualization.md.
 */
export const VIRTUALIZATION_THRESHOLD = 200;

/**
 * Decide whether the virtualized renderer should be used for the current list.
 *
 * Anchored (jump-to-context) mode always stays on the legacy path — a
 * deliberate decision, not a TODO. Anchored sessions start from a small
 * around-fetch and are transient (they exit back to normal mode at the live
 * bottom), so they rarely grow large; porting the bidirectional
 * newer-load/anchored-transition machinery onto the virtualizer carries real
 * regression risk for negligible benefit. Jumps to messages already in the
 * loaded normal window are handled by the virtualized renderer directly.
 */
export const shouldVirtualizeMessages = (
  messageCount: number,
  mode: 'normal' | 'anchored',
): boolean => mode === 'normal' && messageCount >= VIRTUALIZATION_THRESHOLD;
