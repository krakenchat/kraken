import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Box } from "@mui/material";
import { VList, type VListHandle } from "virtua";
import MessageComponent from "./MessageComponent";
import MessageSkeleton from "./MessageSkeleton";
import { UnreadMessageDivider } from "./UnreadMessageDivider";
import type { Message } from "../../types/message.type";
import { VoiceSessionType } from "../../contexts/VoiceContext";

/** How close to the top (in item indices) triggers an older-page load. */
const LOAD_MORE_INDEX_PROXIMITY = 8;
/** How close to the end (in item indices) triggers a newer-page load (anchored mode). */
const LOAD_NEWER_INDEX_PROXIMITY = 8;
/** Distance from the bottom (px) within which the list is considered pinned. */
const BOTTOM_PIN_THRESHOLD_PX = 40;

export interface VirtualMessageListHandle {
  scrollToBottom: () => void;
}

export interface VirtualMessageListProps {
  /** Messages in chronological (oldest-first) render order. */
  orderedMessages: Message[];
  authorId: string;

  /** 'anchored' disables stick-to-bottom and centers on the jump target instead of homing to the bottom. */
  mode?: 'normal' | 'anchored';

  // Older pagination
  isLoadingMore: boolean;
  continuationToken?: string;
  onLoadMore?: () => Promise<void>;

  // Newer pagination (anchored mode)
  onLoadNewer?: () => Promise<void>;
  isLoadingNewer?: boolean;
  hasNewer?: boolean;

  // Unread divider
  unreadCount: number;
  lastReadIndex: number;

  // Search highlight / anchored jump target
  highlightMessageId?: string;
  highlightSeq?: number;

  // Thread / reply handling
  contextId?: string;
  communityId?: string;
  directMessageGroupId?: string;
  onOpenThread?: (message: Message) => void;
  onQuoteReply?: (message: Message) => void;

  /** Changing this (channel/DM switch) re-homes the list at the bottom (or centers, in anchored mode). */
  resetKey?: string;

  /** Reports whether the list is pinned to the visual bottom (drives FABs). */
  onAtBottomChange?: (atBottom: boolean) => void;

  /**
   * Reports the currently visible item index range [start, end] on scroll.
   * Consumed by read-tracking (fed to markAsRead) in MessageContainer.
   */
  onVisibleRangeChange?: (startIndex: number, endIndex: number) => void;
}

/**
 * Virtualized message list built on virtua's {@link VList}.
 *
 * virtua owns the scroll container and scroll position — the single renderer
 * for both normal and anchored (jump-to-message) modes. Key wiring:
 *
 * - **Prepend without a jump**: `shift` is set true on the render where an older
 *   page prepends (oldest id changes + length grows), so virtua maintains the
 *   position from the end instead of the start. Newer-page appends (anchored
 *   mode) change the newest id but not the oldest in the common case, so they
 *   never set `shift` — appending below the viewport needs no index-shift
 *   compensation. At the MESSAGE_MAX_PAGES cap, a newer-page append DOES also
 *   change the oldest id (a whole oldest page — up to 50 messages — is
 *   evicted, page-granular, not just its first message), producing the same
 *   oldest-id-changed signature as an older-page prepend-at-cap —
 *   disambiguated via bounded-prefix content membership (`isCapEvictionAppend`,
 *   next to `isPrepend`'s definition) so `shift` still stays false for the
 *   append.
 * - **Older pagination**: near the top of the visible range, `onLoadMore` fires.
 * - **Newer pagination (anchored)**: near the end of the visible range,
 *   `onLoadNewer` fires (mirrors the older-load trigger; in-flight-guarded).
 * - **Stick-to-bottom**: normal mode only — a newer message appending while
 *   pinned scrolls to the last item. Disabled in anchored mode (a newer page
 *   landing below the viewport must not yank the reader off their spot — see
 *   the stick-to-bottom effect below for the full rationale) and, for normal
 *   mode, effectively never fires while detached from the live edge either:
 *   the query layer (messageCacheUpdaters) never appends to a detached
 *   window, so `newestId` cannot change until a reset — no separate gate
 *   needed here.
 * - **Anchored initial centering**: the highlightMessageId/highlightSeq jump
 *   effect (also used for in-window normal-mode jumps) is the mechanism that
 *   centers on the anchor target — anchored sessions always start from a
 *   URL-driven jump, so a target is present in the common case. It also
 *   naturally covers re-anchoring to a different message while already
 *   anchored (a fresh highlightSeq bump), since it isn't gated on
 *   "first positioning only" the way the initial-positioning effect is.
 *   Both positioning paths use the double-rAF re-assert pattern (a single
 *   rAF races virtua's measurement readiness on first mount).
 * - **atBottom**: derived from virtua's scroll offset, reported upward for FABs.
 */
const VirtualMessageList = forwardRef<VirtualMessageListHandle, VirtualMessageListProps>(
  (
    {
      orderedMessages,
      authorId,
      mode = 'normal',
      isLoadingMore,
      continuationToken,
      onLoadMore,
      onLoadNewer,
      isLoadingNewer,
      hasNewer,
      unreadCount,
      lastReadIndex,
      highlightMessageId,
      highlightSeq,
      contextId,
      communityId,
      directMessageGroupId,
      onOpenThread,
      onQuoteReply,
      resetKey,
      onAtBottomChange,
      onVisibleRangeChange,
    },
    ref,
  ) => {
    const vlistRef = useRef<VListHandle>(null);
    const pinnedRef = useRef(true);
    const initialPositionedRef = useRef(false);

    // Prepend detection: compare against the previous render's first/length.
    const prevOldestIdRef = useRef<string | undefined>(undefined);
    const prevLenRef = useRef(0);
    const prevNewestIdRef = useRef<string | undefined>(undefined);
    // Previous render's full array — a bounded prefix (up to 51 elements) is
    // read, to disambiguate the at-cap case below (see isCapEvictionAppend).
    const prevMessagesRef = useRef<typeof orderedMessages>([]);

    const len = orderedMessages.length;
    const oldestId = orderedMessages[0]?.id;
    const newestId = orderedMessages[len - 1]?.id;

    // At MESSAGE_MAX_PAGES, TanStack evicts pages from the end OPPOSITE the
    // fetch direction, and eviction is PAGE-granular (an entire page — up to
    // the around-page's 50-message size — is dropped at once, not a single
    // message). In normal mode there is only one fetch direction (older), so
    // an older-page load that crosses the cap always evicts the newest page
    // — "oldestId changed" unambiguously means a prepend there.
    //
    // Anchored mode fetches BOTH directions, so that same id-change
    // signature is ambiguous: a newer-page load crossing the cap evicts the
    // OLDEST page (newer pages are prepended to the query's page array via
    // fetchPreviousPage, and TanStack drops from the opposite/tail end) —
    // this is an append, not a prepend, even though oldestId changes exactly
    // like the genuine prepend-at-cap case. Pure id/length comparison can't
    // tell them apart; only content overlap can — and since eviction is
    // page-granular, the new head can land anywhere in the previous array's
    // first ~50 elements, not just its second element.
    //
    // Distinguish via bounded membership: a genuine append-at-cap's new head
    // id always already existed somewhere in the previous array (it's just
    // the previous array with its evicted prefix removed and a new page
    // appended), so it's found within `prevMessages.slice(0, 51)` (51 =
    // one more than the 50-message max page size, so a full-page eviction's
    // new head — at previous index 50 — is still covered). A genuine
    // prepend-at-cap's new head is always a brand-new id from a
    // never-before-loaded page, so it can never satisfy this membership
    // check. This holds regardless of length — a partial-page eviction
    // (fewer messages evicted than appended) grows `len`, but the new head's
    // previous-array membership is unaffected by that.
    const prevMessages = prevMessagesRef.current;
    const isCapEvictionAppend =
      oldestId !== undefined &&
      prevMessages.slice(0, 51).some((message) => message.id === oldestId);

    // True on the render immediately after an older page prepended at the start.
    // At the MESSAGE_MAX_PAGES cap, a prepend adds an older page but evicts the
    // newest page, so `len` stays unchanged — we can't require `len > prevLen`.
    // Instead require `len >= prevLen` (deleting only the oldest message shrinks
    // `len` and is correctly excluded) alongside a defined previous oldest id
    // (guards the context-switch reset, where it's `undefined`) that changed.
    // Anchored-mode newer-page appends leave `oldestId` untouched in the
    // common case, so they are correctly excluded from this too. At the cap
    // they DO change `oldestId` (see isCapEvictionAppend above) — excluded
    // explicitly, since that's an append wearing the prepend's id signature.
    const isPrepend =
      prevOldestIdRef.current !== undefined &&
      oldestId !== prevOldestIdRef.current &&
      len >= prevLenRef.current &&
      !isCapEvictionAppend;

    const scrollToBottom = useCallback(() => {
      const handle = vlistRef.current;
      if (!handle || len === 0) return;
      handle.scrollToIndex(len - 1, { align: "end" });
    }, [len]);

    useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

    // Pending positioning frames (initial positioning AND the highlight/anchor
    // jump below share this — they're mutually exclusive in any given commit).
    // Kept in a ref and cancelled only on unmount, context switch, or mode
    // change — NOT when `len` changes: a prepend can land between scheduling
    // and the frame firing (the anchor-restore case is exactly when the user
    // is near the top), and cancelling then would drop the positioning entirely.
    const positioningRafsRef = useRef<[number, number]>([0, 0]);
    const cancelPositioningRafs = () => {
      cancelAnimationFrame(positioningRafsRef.current[0]);
      cancelAnimationFrame(positioningRafsRef.current[1]);
      positioningRafsRef.current = [0, 0];
    };

    // Guards older-page loads between the call and the next render with
    // isLoadingMore=true (scroll events can arrive faster than React commits).
    const loadOlderInFlightRef = useRef(false);
    // Same, for newer-page loads (anchored mode).
    const loadNewerInFlightRef = useRef(false);

    // Re-home when switching contexts (channel/DM) OR flipping between normal
    // and anchored mode. A mode flip swaps the underlying data source entirely
    // (normal-window cache vs. anchored-window cache) — oldest/newest ids can
    // both change without it being a real prepend/append, so the prepend and
    // stick-to-bottom baselines must reset alongside positioning. The parent
    // is notified immediately so FAB state doesn't stay stale until the first
    // scroll event.
    useEffect(() => {
      cancelPositioningRafs();
      initialPositionedRef.current = false;
      pinnedRef.current = true;
      loadOlderInFlightRef.current = false;
      loadNewerInFlightRef.current = false;
      prevOldestIdRef.current = undefined;
      prevLenRef.current = 0;
      prevNewestIdRef.current = undefined;
      prevMessagesRef.current = [];
      onAtBottomChange?.(true);
    }, [resetKey, mode, onAtBottomChange]);

    // Cancel any pending positioning frames on unmount.
    useEffect(() => cancelPositioningRafs, []);

    // highlightMessageId as of the latest render, read (not depended on) by
    // the initial-positioning effect below so it can detect "no jump target"
    // without re-running positioning on every highlight change.
    const highlightMessageIdRef = useRef(highlightMessageId);
    highlightMessageIdRef.current = highlightMessageId;

    // Initial positioning once data is present.
    // - Normal mode: jump to the newest message (bottom).
    // - Anchored mode: the highlightMessageId/highlightSeq effect below owns
    //   centering on the jump target — anchored sessions always start from a
    //   URL-driven jump, so a target is present in the common case. This
    //   effect only handles the rare fallback where the 3s highlight flash
    //   already expired before the anchored ("around") fetch resolved: land
    //   mid-list and release the pagination suppression, mirroring the legacy
    //   behavior for that race.
    useEffect(() => {
      if (initialPositionedRef.current || len === 0) return;
      const handle = vlistRef.current;
      if (!handle) return;

      if (mode === 'anchored') {
        if (highlightMessageIdRef.current) return;
        const idx = Math.max(0, Math.floor((len - 1) / 2));
        const raf1 = requestAnimationFrame(() => {
          handle.scrollToIndex(idx, { align: "center" });
          positioningRafsRef.current[1] = requestAnimationFrame(() => {
            handle.scrollToIndex(idx, { align: "center" });
          });
        });
        positioningRafsRef.current = [raf1, 0];
        pinnedRef.current = false;
        initialPositionedRef.current = true;
        onAtBottomChange?.(false);
        return;
      }

      // Positioning is deferred a frame (VList hasn't initialized/measured at
      // mount — an immediate scrollToIndex can be a no-op) and re-asserted a
      // second frame later, after the first measurement pass corrects the
      // estimated offsets.
      const raf1 = requestAnimationFrame(() => {
        handle.scrollToIndex(len - 1, { align: "end" });
        positioningRafsRef.current[1] = requestAnimationFrame(() => {
          handle.scrollToIndex(len - 1, { align: "end" });
        });
      });
      positioningRafsRef.current = [raf1, 0];
      pinnedRef.current = true;
      initialPositionedRef.current = true;
      onAtBottomChange?.(true);
      // highlightMessageId is read via a ref (not a dep) so this effect
      // doesn't re-run on every highlight change — only at the start of a
      // positioning epoch. resetKey/mode are deps so a context/mode switch
      // re-positions even when the new context has the same message count.
    }, [len, resetKey, mode, onAtBottomChange]);

    // Stick-to-bottom: a newer message appended while pinned (not a prepend).
    // Normal mode ONLY: in anchored mode a newest-id change means a newer page
    // was appended below the viewport (loaded via onLoadNewer) — it needs no
    // correction, and forcing the scroll to the bottom would teleport the
    // reader past the loaded page, immediately re-trigger the newer-load
    // proximity check, and cascade newer loads all the way to the present.
    // (Detached-from-live-edge in normal mode needs no separate gate: the
    // query layer never appends to a detached window, so newestId cannot
    // change there until a reset.)
    useEffect(() => {
      if (
        mode === 'normal' &&
        prevNewestIdRef.current !== undefined &&
        newestId !== prevNewestIdRef.current &&
        pinnedRef.current &&
        !isPrepend
      ) {
        // Defer to let virtua measure the new row before scrolling to it.
        requestAnimationFrame(() => scrollToBottom());
      }
      prevNewestIdRef.current = newestId;
      // isPrepend is derived from the same inputs; intentionally not a dep.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newestId, scrollToBottom, mode]);

    // Record prepend baselines AFTER the render that consumed them.
    useEffect(() => {
      prevOldestIdRef.current = oldestId;
      prevLenRef.current = len;
      prevMessagesRef.current = orderedMessages;
    });

    // Jump-to-message / anchored initial centering (once per highlightSeq,
    // mirroring the legacy hook's seq-gating so re-clicks re-scroll but
    // pagination re-renders don't). Centers the target; the row mounts as it
    // enters virtua's window and its `${id}-hl-${seq}` key remounts it,
    // (re)starting the CSS flash. Double-rAF re-assert: a single rAF can race
    // virtua's measurement readiness, especially for a freshly-mounted
    // anchored window.
    const lastScrolledSeqRef = useRef(0);
    useEffect(() => {
      if (
        !highlightMessageId ||
        highlightSeq === undefined ||
        highlightSeq <= lastScrolledSeqRef.current
      ) {
        return;
      }
      const handle = vlistRef.current;
      if (!handle) return;
      const idx = orderedMessages.findIndex((m) => m.id === highlightMessageId);
      if (idx < 0) return;

      cancelPositioningRafs();
      const raf1 = requestAnimationFrame(() => {
        handle.scrollToIndex(idx, { align: "center" });
        positioningRafsRef.current[1] = requestAnimationFrame(() => {
          handle.scrollToIndex(idx, { align: "center" });
        });
      });
      positioningRafsRef.current = [raf1, 0];
      lastScrolledSeqRef.current = highlightSeq;

      if (mode === 'anchored') {
        pinnedRef.current = false;
        initialPositionedRef.current = true;
        onAtBottomChange?.(false);
      }
    }, [highlightMessageId, highlightSeq, orderedMessages, mode, onAtBottomChange]);

    const handleScroll = useCallback(
      (offset: number) => {
        const handle = vlistRef.current;
        if (!handle) return;

        const { scrollSize, viewportSize } = handle;
        const distanceFromBottom = scrollSize - offset - viewportSize;
        const atBottom = distanceFromBottom < BOTTOM_PIN_THRESHOLD_PX;
        pinnedRef.current = atBottom;
        onAtBottomChange?.(atBottom);

        const startIndex = handle.findItemIndex(offset);
        const endIndex = handle.findItemIndex(offset + viewportSize);
        onVisibleRangeChange?.(startIndex, endIndex);

        // Older-page load: near the top, not already loading, more to fetch.
        // The in-flight ref covers the window between this call and the next
        // render with isLoadingMore=true.
        if (
          initialPositionedRef.current &&
          startIndex <= LOAD_MORE_INDEX_PROXIMITY &&
          !isLoadingMore &&
          !loadOlderInFlightRef.current &&
          continuationToken &&
          onLoadMore
        ) {
          loadOlderInFlightRef.current = true;
          void onLoadMore().finally(() => {
            loadOlderInFlightRef.current = false;
          });
        }

        // Newer-page load (anchored mode): near the end, not already loading,
        // more to fetch. Mirrors the older-load trigger above.
        if (
          initialPositionedRef.current &&
          mode === 'anchored' &&
          endIndex >= len - 1 - LOAD_NEWER_INDEX_PROXIMITY &&
          !isLoadingNewer &&
          !loadNewerInFlightRef.current &&
          hasNewer &&
          onLoadNewer
        ) {
          loadNewerInFlightRef.current = true;
          void onLoadNewer().finally(() => {
            loadNewerInFlightRef.current = false;
          });
        }
      },
      [
        isLoadingMore,
        continuationToken,
        onLoadMore,
        onAtBottomChange,
        onVisibleRangeChange,
        mode,
        isLoadingNewer,
        hasNewer,
        onLoadNewer,
        len,
      ],
    );

    return (
      <Box
        data-testid="virtual-scroll-container"
        sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        {isLoadingMore && (
          <Box sx={{ p: 2, textAlign: "center", flexShrink: 0 }}>
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
          </Box>
        )}
        <VList
          ref={vlistRef}
          shift={isPrepend}
          onScroll={handleScroll}
          style={{ flex: 1, minHeight: 0 }}
        >
          {orderedMessages.map((message, index) => {
            const isHighlighted = highlightMessageId === message.id;
            const showDividerBefore =
              unreadCount > 0 && lastReadIndex !== -1 && index === lastReadIndex + 1;
            // Composite key restarts the CSS flash on re-clicks (highlightSeq).
            const key = isHighlighted
              ? `${message.id}-hl-${highlightSeq}`
              : message.id;

            return (
              <div key={key} data-message-id={message.id}>
                {showDividerBefore && (
                  <UnreadMessageDivider unreadCount={unreadCount} />
                )}
                <MessageComponent
                  message={message}
                  isAuthor={message.authorId === authorId}
                  isSearchHighlight={isHighlighted}
                  contextId={contextId}
                  communityId={communityId}
                  onOpenThread={onOpenThread}
                  onQuoteReply={onQuoteReply}
                  contextType={
                    directMessageGroupId
                      ? VoiceSessionType.Dm
                      : VoiceSessionType.Channel
                  }
                />
              </div>
            );
          })}
        </VList>
        {isLoadingNewer && (
          <Box sx={{ p: 2, textAlign: "center", flexShrink: 0 }}>
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
          </Box>
        )}
      </Box>
    );
  },
);

VirtualMessageList.displayName = "VirtualMessageList";

export default VirtualMessageList;
