# Message list virtualization

Status: **implemented — `VirtualMessageList` (virtua `VList`) is the single renderer for both normal and anchored (jump-to-message) mode.** There is no message-count threshold and no legacy non-virtualized path anymore; both were removed once anchored mode was ported onto virtua (the dual-path era is documented in git history — see PR #402 for the original threshold-gated prototype and the PR that removed the gate).

## Architecture

- **`components/Message/MessageContainer.tsx`** — the orchestrator. Reverses the
  newest-first `messages` prop (the `useMessages`/`useAnchoredMessages`
  contract) into chronological (oldest-first) order for rendering — DOM/array
  order = chronological order is load-bearing: native cross-message text
  selection follows it. Owns: loading/error/empty states, the FAB routing
  (scroll-to-bottom vs. "Jump to Present" vs. detached-from-live-edge reset),
  the detached→live scroll follow-through retry (`#404`), and feeding
  read-tracking (`useMessageVisibility`'s `markAsRead`) from
  `VirtualMessageList`'s visible-range callback. It does **not** own scroll
  position, prepend/append stabilization, or pagination triggers — those live
  entirely inside `VirtualMessageList`.
- **`components/Message/VirtualMessageList.tsx`** — virtua owns the scroll
  container and scrollTop for both modes:
  - **Prepend**: virtua's `shift` prop, set true on the render where an older
    page prepends (oldest id changes, length grows or holds at the
    `MESSAGE_MAX_PAGES` cap). Newer-page appends (anchored mode) only change
    the newest id, never the oldest, so they never set `shift` — appending
    below the viewport needs no index-shift compensation.
  - **Late growth** (image/embed load): virtua re-measures via its own
    `ResizeObserver` and compensates above-viewport growth natively.
  - **Normal-mode initial positioning**: jump to the newest message (bottom).
  - **Anchored-mode initial positioning**: center on the jump target
    (`highlightMessageId`, `align: 'center'`) via the same
    highlightMessageId/highlightSeq effect that handles in-window jumps —
    anchored sessions always start from a URL-driven jump, so a target is
    present in the common case. It also naturally covers re-anchoring to a
    different message while already anchored (a fresh `highlightSeq` bump).
    The rare fallback — the 3s highlight flash already expired before the
    anchored ("around") fetch resolved — lands mid-list instead. Both paths
    use a double-rAF re-assert (a single rAF races virtua's measurement
    readiness on first mount — the same race PR #416 diagnosed for the
    live-edge reset case).
  - **Stick-to-bottom**: normal mode only. A newer message appending while
    pinned scrolls to the last item. Disabled in anchored mode — a newer page
    landing below the viewport must not yank the reader off their spot and
    cascade newer loads to the present. Also effectively never fires while
    detached from the live edge in normal mode: the query layer
    (`messageCacheUpdaters.ts`) never appends to a detached window, so
    `newestId` cannot change until a reset — no separate renderer-level gate
    needed for that case.
  - **Older pagination**: near the top of the visible index range, `onLoadMore`
    fires (in-flight-guarded).
  - **Newer pagination (anchored mode)**: near the end of the visible index
    range, `onLoadNewer` fires — the mirror image of older-pagination
    (in-flight-guarded, suppressed until initial positioning completes).
  - **Auto-exit to present**: `useAnchoredModeTransition` watches
    `mode`/`atBottom`/`hasNewer`/`isLoadingNewer` signals only (no
    scroll-container refs) and calls `jumpToPresent()` once the reader reaches
    the bottom of a fully-loaded anchored window. The mode flip back to
    'normal' doesn't need its own scroll-to-bottom side effect — a mode change
    re-runs `VirtualMessageList`'s initial positioning, which lands at the
    bottom in normal mode with no highlight target.
  - **Read tracking**: `useMessageVisibility` no longer runs an
    `IntersectionObserver` at all — that branch was only needed for the
    now-deleted non-virtualized path (off-screen rows there were real DOM
    nodes; virtua unmounts them). The hook is reduced to the debounced
    `markAsRead` side effect (optimistic cache clear + 1s-debounced socket
    emit), fed by `VirtualMessageList`'s `onVisibleRangeChange` → the latest
    visible message in chronological order. This fires in anchored mode too —
    the legacy observer it replaces had no mode gating either, so messages
    scrolling into view while reading history via a jump are marked read
    exactly as before.
- **`hooks/useJumpToMessage.ts`** — unchanged, renderer-agnostic. Decides
  normal vs. anchored mode by checking whether the target message is already
  in the loaded normal window; if so, it stays in normal mode and
  `VirtualMessageList`'s highlightMessageId/highlightSeq jump handles it as an
  in-window jump (no anchored fetch needed).

## Known regression (accepted)

Text selection across the virtua window boundary — selections spanning beyond
mounted rows are lost on scroll. This applies uniformly now (there is no
small-list DOM-backed fallback anymore); the trade-off was already accepted
when virtua became universal for normal mode, and porting anchored mode onto
the same renderer doesn't change the calculus.

## Non-goal: anchored-mode cache is not WS-synced

The anchored (`useAnchoredMessages`) query cache does not receive live
WebSocket updates — edits, deletes, or new messages arriving while the reader
is in an anchored session don't touch that cache (see
`socket-hub/handlers/messageHandlers.ts`). This is an intentional, accepted
tradeoff: anchored sessions are transient (they exit back to normal mode once
the reader reaches the live edge), so the staleness window is bounded and
resolves itself. This has not changed as part of unifying the renderer.
