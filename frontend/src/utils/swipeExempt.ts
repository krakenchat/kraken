/**
 * Swipe-exemption heuristic.
 *
 * Navigation swipes on the mobile chat surface must NOT trigger when the gesture
 * begins inside content that has its own horizontal handling or where a swipe
 * would fight the user's intent. A gesture is exempt when it starts on (or
 * inside) any of:
 *
 *  - Text-entry / selection surfaces: `input`, `textarea`, `[contenteditable]`
 *    (the message composer, edit fields) — swiping there is text selection.
 *  - `pre` (code blocks) and `.hljs` (syntax-highlighted code) — these scroll
 *    horizontally.
 *  - An explicit opt-out marker: `[data-swipe-exempt]` — attach this to any
 *    horizontally scrollable widget (image galleries, carousels, wide tables).
 *  - An ancestor (up to a few levels) whose inline style or computed style sets
 *    `overflow-x: auto | scroll` AND is actually scrollable (`scrollWidth >
 *    clientWidth`). This is a best-effort catch for horizontally scrollable
 *    regions that didn't opt out explicitly.
 *
 * The heuristic is deliberately conservative and cheap — it walks at most a
 * handful of ancestors. When in doubt, add `data-swipe-exempt` to the element.
 */

const EXEMPT_SELECTOR = [
  'input',
  'textarea',
  '[contenteditable="true"]',
  'pre',
  '.hljs',
  '[data-swipe-exempt]',
].join(',');

/** Max ancestors to inspect for horizontal scrollability. */
const MAX_ANCESTOR_DEPTH = 8;

const hasHorizontalOverflowStyle = (el: Element): boolean => {
  // Only exempt when the element can actually scroll horizontally — an
  // overflow-x style on a container that fits its content shouldn't block
  // navigation swipes.
  const htmlEl = el as HTMLElement;
  if (htmlEl.scrollWidth <= htmlEl.clientWidth) return false;

  // Cheap inline-style check first (avoids computed-style layout work).
  const inline = el.getAttribute('style');
  if (inline && /overflow-x\s*:\s*(auto|scroll)/i.test(inline)) {
    return true;
  }

  // Computed-style check, guarded for environments without getComputedStyle.
  if (typeof window === 'undefined' || !window.getComputedStyle) return false;
  try {
    const overflowX = window.getComputedStyle(el).overflowX;
    return overflowX === 'auto' || overflowX === 'scroll';
  } catch {
    return false;
  }
};

/**
 * Whether a swipe starting on `target` should be exempt from navigation.
 */
export const isSwipeExemptTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;

  if (target.closest(EXEMPT_SELECTOR)) return true;

  let el: Element | null = target;
  for (let depth = 0; el && depth < MAX_ANCESTOR_DEPTH; depth += 1) {
    if (hasHorizontalOverflowStyle(el)) return true;
    el = el.parentElement;
  }

  return false;
};
