import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";

interface UseBidirectionalScrollOptions {
  /** Messages newest-first (prop contract); the DOM renders them oldest-first. */
  messages: { id: string }[];
  mode: 'normal' | 'anchored';
  highlightMessageId?: string;
  /** Sequence counter — increments on every jump request so re-clicks to the same message trigger a new scroll. */
  highlightSeq?: number;
  /** Identifies the current context (channel/DM); changing it resets positioning state. */
  resetKey?: string;

  // Older pagination
  onLoadMore?: () => Promise<void>;
  isLoadingMore: boolean;
  continuationToken?: string;

  // Newer pagination (anchored mode)
  onLoadNewer?: () => Promise<void>;
  isLoadingNewer?: boolean;
  hasNewer?: boolean;
}

/**
 * Manages bidirectional infinite scroll for a chronological (oldest-first DOM)
 * message list in a normal `column` flex container.
 *
 * The container renders with `overflowAnchor: "none"` — this hook is the single
 * owner of scroll stabilization. Chrome's native anchoring is suppressed at
 * scrollTop===0, which is exactly when older pages load in a normal column, so
 * it cannot be relied on and must not double-compensate.
 *
 * Handles:
 * - Initial positioning at the bottom (newest message) per context (resetKey)
 * - IntersectionObserver sentinels for older (visual top / DOM start) and
 *   newer (visual bottom / DOM end) pagination
 * - Scroll stabilization when older messages are prepended (both modes)
 * - Stick-to-bottom for new messages and late content growth while pinned
 * - Scroll-to-highlight for jump-to-message
 * - Load suppression until initial positioning / highlight scroll completes
 */
export const useBidirectionalScroll = ({
  messages,
  mode,
  highlightMessageId,
  highlightSeq = 0,
  resetKey,
  onLoadMore,
  isLoadingMore,
  continuationToken,
  onLoadNewer,
  isLoadingNewer,
  hasNewer,
}: UseBidirectionalScrollOptions) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [atBottom, setAtBottom] = useState(true);

  // Suppresses onLoadNewer until the initial scroll-to-highlight completes.
  // Without this, an anchored list may momentarily show the bottom sentinel
  // before the highlight scroll fires, triggering cascading newer loads.
  const newerLoadSuppressedRef = useRef(false);

  // Suppresses onLoadMore until initial positioning completes. A normal column
  // starts at scrollTop=0 (visual TOP), so the top sentinel is visible on first
  // render — without this guard, older pages would cascade before the initial
  // scroll-to-bottom (or scroll-to-highlight in anchored mode) runs.
  const olderLoadSuppressedRef = useRef(true);

  // True once the initial scroll position for the current context has been set
  // (scroll-to-bottom in normal mode, scroll-to-highlight in anchored mode).
  const initialPositionedRef = useRef(false);

  // Whether the user is at (or near) the visual bottom — used to decide if new
  // messages / content growth should keep the view glued to the bottom.
  const pinnedToBottomRef = useRef(true);

  // Older-prepend stabilization state.
  const prevScrollHeightRef = useRef(0);
  const prevOldestIdRef = useRef<string | undefined>(undefined);
  // Stick-to-bottom state.
  const prevNewestIdRef = useRef<string | undefined>(undefined);

  // Single ref for all pagination state — keeps IntersectionObservers stable.
  // Without this, observers would be recreated on every loading/token change,
  // and each recreation fires a fresh initial callback that re-triggers loading.
  const paginationRef = useRef({ onLoadMore, isLoadingMore, continuationToken, onLoadNewer, isLoadingNewer, hasNewer });
  paginationRef.current = { onLoadMore, isLoadingMore, continuationToken, onLoadNewer, isLoadingNewer, hasNewer };

  const hasMessages = messages.length > 0;

  // Bottom sentinel: last in DOM = visual bottom in a normal column.
  // Tracks atBottom state; in anchored mode also triggers newer message loading.
  // NOTE: must stay the FIRST observer-creating effect — tests index observers
  // by creation order (bottom first, top second).
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setAtBottom(entry.isIntersecting);
        const p = paginationRef.current;
        if (
          entry.isIntersecting &&
          mode === 'anchored' &&
          p.onLoadNewer &&
          !p.isLoadingNewer &&
          p.hasNewer &&
          !newerLoadSuppressedRef.current
        ) {
          p.onLoadNewer();
        }
      },
      { root: container, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMessages, mode]);

  // Top sentinel: first in DOM = visual top in a normal column.
  // Triggers older message loading once initial positioning has completed.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const p = paginationRef.current;
        if (
          entry.isIntersecting &&
          !p.isLoadingMore &&
          p.continuationToken &&
          p.onLoadMore &&
          !olderLoadSuppressedRef.current
        ) {
          p.onLoadMore();
        }
      },
      { root: container, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMessages]);

  // Reset positioning/stabilization state when switching contexts (channel/DM).
  // Declared before the positioning and stabilization effects so it runs first
  // within the same commit.
  const prevResetKeyRef = useRef(resetKey);
  useLayoutEffect(() => {
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    initialPositionedRef.current = false;
    olderLoadSuppressedRef.current = true;
    pinnedToBottomRef.current = true;
    prevScrollHeightRef.current = 0;
    prevOldestIdRef.current = undefined;
    prevNewestIdRef.current = undefined;
  }, [resetKey]);

  // Initial positioning on the first non-empty message set for this context.
  // Normal mode: jump straight to the bottom (newest message) and release the
  // older-load suppression. Anchored mode: positioning belongs to the
  // scroll-to-highlight effect below; suppression stays on until it fires.
  useLayoutEffect(() => {
    if (initialPositionedRef.current) return;
    const container = scrollContainerRef.current;
    if (!container || messages.length === 0) return;

    if (mode === 'anchored') {
      // If the around-fetch outlived the highlight flash, highlightMessageId
      // is already cleared by the time messages arrive and the
      // scroll-to-highlight effect will never fire. Position mid-list (the
      // fetch centers on the target message) and — crucially — release the
      // positioning machine so pagination suppression doesn't stick forever.
      if (!highlightMessageId) {
        container.scrollTop = Math.max(
          0,
          (container.scrollHeight - container.clientHeight) / 2,
        );
        initialPositionedRef.current = true;
        olderLoadSuppressedRef.current = false;
        newerLoadSuppressedRef.current = false;
      }
      return;
    }

    container.scrollTop = container.scrollHeight;
    initialPositionedRef.current = true;
    olderLoadSuppressedRef.current = false;
  }, [messages, mode, highlightMessageId]);

  // Older-prepend stabilization (both modes). Older pages are inserted at the
  // DOM start, which grows scrollHeight above the viewport and would yank the
  // view upward. Shifting scrollTop by the height delta keeps the current view
  // stable. (Newer pages in anchored mode append at the DOM end and need no
  // compensation.)
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || messages.length === 0) return;

    const oldestId = messages[messages.length - 1]?.id;
    const currentScrollHeight = container.scrollHeight;
    const prevScrollHeight = prevScrollHeightRef.current;

    if (
      initialPositionedRef.current &&
      prevOldestIdRef.current !== undefined &&
      oldestId !== prevOldestIdRef.current &&
      prevScrollHeight > 0 &&
      currentScrollHeight > prevScrollHeight
    ) {
      container.scrollTop += currentScrollHeight - prevScrollHeight;
    }

    prevScrollHeightRef.current = currentScrollHeight;
    prevOldestIdRef.current = oldestId;
  }, [messages]);

  // Stick-to-bottom on new messages: when the newest message changes while the
  // user is pinned to the bottom, keep the view glued to the bottom.
  // (messages prop is newest-first, so messages[0] is the newest.)
  // Normal mode ONLY: in anchored mode a newest-id change means a newer page
  // was appended below the viewport (websocket handlers never touch the
  // anchored cache) — it needs no correction, and forcing scrollTop to the
  // bottom would teleport the user past the loaded page, re-trigger the bottom
  // sentinel, and cascade newer loads all the way to the present.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || messages.length === 0) return;

    const newestId = messages[0]?.id;
    if (
      mode === 'normal' &&
      prevNewestIdRef.current !== undefined &&
      newestId !== prevNewestIdRef.current &&
      pinnedToBottomRef.current
    ) {
      container.scrollTop = container.scrollHeight;
    }
    prevNewestIdRef.current = newestId;
  }, [messages, mode]);

  // Track whether the user is pinned to the visual bottom.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      pinnedToBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [hasMessages]);

  // Bottom-pin on content growth (late-loading images/embeds). With native
  // overflow anchoring disabled (overflowAnchor: "none"), content that grows
  // near the bottom would otherwise push the newest message out of view.
  // Normal mode ONLY: this observer is recreated on message changes and its
  // initial callbacks fire with a possibly stale pinned=true — in anchored
  // mode that would teleport the user to the bottom after a newer page load
  // (see the stick-to-bottom gate above; both mechanisms must be gated).
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    if (mode !== 'normal') return;

    const ro = new ResizeObserver(() => {
      if (pinnedToBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });
    ro.observe(container);
    for (const child of Array.from(container.children)) {
      ro.observe(child);
    }
    return () => ro.disconnect();
  }, [hasMessages, messages, mode]);

  // Above-viewport growth compensation while reading history. When media above
  // the viewport finishes loading (image placeholder swap, late link embed),
  // the content below it — including the user's viewport — gets pushed down.
  // With overflowAnchor: "none" nothing else compensates, so track each
  // message element's height and shift scrollTop by the growth delta when the
  // grown element sits above the viewport while the user is NOT pinned to the
  // bottom (the bottom-pin observer owns the pinned case). The first callback
  // for a newly observed element only records its height — no compensation —
  // which also avoids double-compensating prepended pages (the oldest-id
  // stabilization above already handles those).
  const knownHeightsRef = useRef(new WeakMap<Element, number>());
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const heights = knownHeightsRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target;
        const newHeight = el.getBoundingClientRect().height;
        const prevHeight = heights.get(el);
        heights.set(el, newHeight);
        if (prevHeight === undefined) continue; // first observation: record only
        const delta = newHeight - prevHeight;
        if (delta <= 0) continue;
        if (pinnedToBottomRef.current) continue; // bottom-pin owns this case
        if (el.getBoundingClientRect().top < container.getBoundingClientRect().top) {
          container.scrollTop += delta;
        }
      }
    });
    // messageRefs is populated by render-time ref callbacks, so by the time
    // this effect runs it holds the current message elements; unmounted
    // elements were removed by their ref callbacks and simply aren't
    // re-observed (disconnect below drops them from the old observer).
    for (const el of messageRefs.current.values()) {
      ro.observe(el);
    }
    return () => ro.disconnect();
  }, [messages]);

  // Suppress pagination when entering anchored mode, until scroll-to-highlight
  // completes. When the highlight clears (flash timeout or mode change), lift
  // the newer suppression; the older suppression is lifted only once initial
  // positioning has happened for this context.
  useEffect(() => {
    const suppress = mode === 'anchored' && !!highlightMessageId;
    newerLoadSuppressedRef.current = suppress;
    if (suppress) {
      olderLoadSuppressedRef.current = true;
    } else if (initialPositionedRef.current) {
      olderLoadSuppressedRef.current = false;
    }
  }, [mode, highlightMessageId]);

  // Scroll to highlighted message (once per highlightSeq).
  // Uses a seq counter instead of message ID so re-clicks to the same message
  // always trigger a new scroll. Avoids re-scrolling on pagination re-renders.
  const lastScrolledSeqRef = useRef(0);
  useEffect(() => {
    if (!highlightMessageId || highlightSeq <= lastScrolledSeqRef.current) {
      return;
    }
    if (messages.length > 0) {
      const el = messageRefs.current.get(highlightMessageId);
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "center" });
        lastScrolledSeqRef.current = highlightSeq;
        initialPositionedRef.current = true;
        // Allow pagination after the browser processes the scroll
        requestAnimationFrame(() => {
          newerLoadSuppressedRef.current = false;
          olderLoadSuppressedRef.current = false;
        });
      }
    }
  }, [highlightMessageId, highlightSeq, messages]);

  // Visual bottom is scrollTop = scrollHeight in a normal column.
  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  return {
    scrollContainerRef,
    bottomSentinelRef,
    topSentinelRef,
    messageRefs,
    atBottom,
    scrollToBottom,
  };
};
