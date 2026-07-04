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
/** Distance from the bottom (px) within which the list is considered pinned. */
const BOTTOM_PIN_THRESHOLD_PX = 40;

export interface VirtualMessageListHandle {
  scrollToBottom: () => void;
}

export interface VirtualMessageListProps {
  /** Messages in chronological (oldest-first) render order. */
  orderedMessages: Message[];
  authorId: string;

  // Older pagination
  isLoadingMore: boolean;
  continuationToken?: string;
  onLoadMore?: () => Promise<void>;

  // Unread divider
  unreadCount: number;
  lastReadIndex: number;

  // Search highlight
  highlightMessageId?: string;
  highlightSeq?: number;

  // Thread / reply handling
  contextId?: string;
  communityId?: string;
  directMessageGroupId?: string;
  onOpenThread?: (message: Message) => void;
  onQuoteReply?: (message: Message) => void;

  /** Changing this (channel/DM switch) re-homes the list at the bottom. */
  resetKey?: string;

  /**
   * Reading position captured from the legacy list when the virtualization
   * gate flipped mid-session: the topmost visible message id and its offset
   * (px) below the viewport top. When set (and the id is present), initial
   * positioning restores this position instead of jumping to the bottom.
   */
  initialAnchor?: { id: string; offsetTop: number } | null;

  /** Reports whether the list is pinned to the visual bottom (drives FABs). */
  onAtBottomChange?: (atBottom: boolean) => void;

  /**
   * Reports the currently visible item index range [start, end] on scroll.
   * Consumed by read-tracking in the virtualized path (step 5).
   */
  onVisibleRangeChange?: (startIndex: number, endIndex: number) => void;
}

/**
 * Virtualized message list built on virtua's {@link VList}.
 *
 * virtua owns the scroll container and scroll position here (the legacy
 * `useBidirectionalScroll` manual math is disabled in this path). Key wiring:
 *
 * - **Prepend without a jump**: `shift` is set true on the render where an older
 *   page prepends (oldest id changes + length grows), so virtua maintains the
 *   position from the end instead of the start.
 * - **Older pagination**: replaces the top sentinel — when the visible start
 *   index nears the top, `onLoadMore` fires.
 * - **Stick-to-bottom**: when a newer message appends while pinned, scroll to
 *   the last item.
 * - **atBottom**: derived from virtua's scroll offset, reported upward for FABs.
 */
const VirtualMessageList = forwardRef<VirtualMessageListHandle, VirtualMessageListProps>(
  (
    {
      orderedMessages,
      authorId,
      isLoadingMore,
      continuationToken,
      onLoadMore,
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
      initialAnchor,
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

    const len = orderedMessages.length;
    const oldestId = orderedMessages[0]?.id;
    const newestId = orderedMessages[len - 1]?.id;

    // True on the render immediately after an older page prepended at the start.
    const isPrepend =
      prevLenRef.current > 0 &&
      len > prevLenRef.current &&
      oldestId !== prevOldestIdRef.current;

    const scrollToBottom = useCallback(() => {
      const handle = vlistRef.current;
      if (!handle || len === 0) return;
      handle.scrollToIndex(len - 1, { align: "end" });
    }, [len]);

    useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

    // Re-home at the bottom when switching contexts (channel/DM).
    useEffect(() => {
      initialPositionedRef.current = false;
      pinnedRef.current = true;
      prevOldestIdRef.current = undefined;
      prevLenRef.current = 0;
      prevNewestIdRef.current = undefined;
    }, [resetKey]);

    // Initial positioning once data is present. If a transition anchor was
    // captured (legacy → virtual flip while reading history), restore that
    // reading position; otherwise jump to the newest message.
    const initialAnchorRef = useRef(initialAnchor);
    initialAnchorRef.current = initialAnchor;
    useEffect(() => {
      if (initialPositionedRef.current || len === 0) return;
      const handle = vlistRef.current;
      if (!handle) return;

      const anchor = initialAnchorRef.current;
      const anchorIndex = anchor
        ? orderedMessages.findIndex((m) => m.id === anchor.id)
        : -1;

      // Positioning is deferred a frame (VList hasn't initialized/measured at
      // mount — an immediate scrollToIndex can be a no-op) and re-asserted a
      // second frame later, after the first measurement pass corrects the
      // estimated offsets. Positions are estimate-based, so anchor restoration
      // is approximate — the goal is keeping the reader in the neighborhood
      // instead of teleporting them.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        if (anchor && anchorIndex >= 0) {
          handle.scrollToIndex(anchorIndex, { align: "start" });
          raf2 = requestAnimationFrame(() => {
            handle.scrollToIndex(anchorIndex, { align: "start" });
            if (anchor.offsetTop !== 0) handle.scrollBy(-anchor.offsetTop);
          });
        } else {
          handle.scrollToIndex(len - 1, { align: "end" });
          raf2 = requestAnimationFrame(() => {
            handle.scrollToIndex(len - 1, { align: "end" });
          });
        }
      });

      const anchored = !!(anchor && anchorIndex >= 0);
      pinnedRef.current = !anchored;
      initialPositionedRef.current = true;
      onAtBottomChange?.(!anchored);
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
      // orderedMessages identity changes with len; anchor lookup uses the ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [len, onAtBottomChange]);

    // Stick-to-bottom: a newer message appended while pinned (not a prepend).
    useEffect(() => {
      if (
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
    }, [newestId, scrollToBottom]);

    // Record prepend baselines AFTER the render that consumed them.
    useEffect(() => {
      prevOldestIdRef.current = oldestId;
      prevLenRef.current = len;
    });

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
        if (
          initialPositionedRef.current &&
          startIndex <= LOAD_MORE_INDEX_PROXIMITY &&
          !isLoadingMore &&
          continuationToken &&
          onLoadMore
        ) {
          onLoadMore();
        }
      },
      [isLoadingMore, continuationToken, onLoadMore, onAtBottomChange, onVisibleRangeChange],
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
      </Box>
    );
  },
);

VirtualMessageList.displayName = "VirtualMessageList";

export default VirtualMessageList;
