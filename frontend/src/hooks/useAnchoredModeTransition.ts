import { useEffect, useRef } from "react";

interface UseAnchoredModeTransitionOptions {
  mode: 'normal' | 'anchored';
  atBottom: boolean;
  hasNewer?: boolean;
  isLoadingNewer?: boolean;
  jumpToPresent?: () => void;
}

/**
 * Handles automatic transition from anchored mode back to normal mode.
 *
 * Signals-only: driven entirely by `mode`/`atBottom`/`hasNewer`/`isLoadingNewer`,
 * no scroll-container refs. The actual "land at the bottom" scroll on the
 * anchored→normal transition is no longer this hook's job — it falls out of
 * VirtualMessageList's own reset-on-mode-change positioning (a mode flip
 * re-runs initial positioning, which jumps to the bottom in normal mode with
 * no highlight target). This hook only decides WHEN to flip modes.
 *
 * - Auto-calls jumpToPresent when the user scrolls to the bottom and all newer
 *   messages are loaded (hasNewer === false).
 * - Guards against false triggers on initial render via hasBeenAwayFromBottom
 *   tracking: atBottom starts as the stale default (true) on the render where
 *   mode first flips to 'anchored', before VirtualMessageList's own centering
 *   effect has had a chance to report the real (centered, not-at-bottom)
 *   position — so an immediate atBottom=true must not be trusted until the
 *   consumer has observed at least one genuine atBottom=false.
 */
export const useAnchoredModeTransition = ({
  mode,
  atBottom,
  hasNewer,
  isLoadingNewer,
  jumpToPresent,
}: UseAnchoredModeTransitionOptions) => {
  const hasBeenAwayFromBottomRef = useRef(false);
  useEffect(() => {
    if (mode !== 'anchored') {
      hasBeenAwayFromBottomRef.current = false;
    } else if (!atBottom) {
      hasBeenAwayFromBottomRef.current = true;
    }
  }, [mode, atBottom]);

  useEffect(() => {
    if (
      mode === 'anchored' &&
      atBottom &&
      hasNewer === false &&
      !isLoadingNewer &&
      jumpToPresent &&
      hasBeenAwayFromBottomRef.current
    ) {
      jumpToPresent();
    }
  }, [mode, atBottom, hasNewer, isLoadingNewer, jumpToPresent]);
};
