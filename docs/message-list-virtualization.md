# Message list virtualization — investigation

Status: **investigation only, no code changes.** This documents the current
message-list architecture and what a virtualization effort would have to
preserve. File references are to `frontend/src`.

## Current architecture

The message list is **not** virtualized today. Every loaded message renders a
real DOM node. The moving parts:

- **`components/Message/MessageContainer.tsx`** — renders the scroll container
  (`overflowY: auto`, `overflowAnchor: none`) as a normal `column` flex box,
  oldest-first in DOM order (chronological), with a top sentinel and a bottom
  sentinel `Box`. Messages arrive newest-first (the `useMessages` contract) and
  are reversed for render. DOM order = chronological order is load-bearing:
  native cross-message text selection follows DOM order.
- **`hooks/useBidirectionalScroll.ts`** — the single owner of scroll position.
  It:
  - positions the view at the bottom (normal mode) or scroll-to-highlight
    (anchored mode) on first non-empty render per context (`resetKey`);
  - runs two `IntersectionObserver`s on the sentinels — top sentinel triggers
    `onLoadMore` (older), bottom sentinel triggers `onLoadNewer` (anchored) and
    tracks `atBottom`;
  - **stabilizes scroll on older-prepend** by measuring `scrollHeight` before/
    after and shifting `scrollTop` by the delta (native anchoring is explicitly
    disabled because Chrome suppresses it at `scrollTop === 0`, which is exactly
    when older pages load);
  - **sticks to bottom** for new messages / late content growth while pinned,
    via a `ResizeObserver` on the container and its children;
  - **compensates above-viewport growth** (image placeholder → image, late link
    embeds) by tracking each message element's height in a `WeakMap` and shifting
    `scrollTop` by the growth delta when the grown element sits above the
    viewport and the user is not pinned;
  - suppresses pagination until initial positioning / highlight scroll completes.
- **`hooks/useMessageVisibility.ts`** — an `IntersectionObserver` over the
  message elements (via `messageRefs`) that marks messages read as they enter the
  viewport. It needs the real message DOM nodes to observe.
- **`hooks/useAnchoredModeTransition.ts`** — flips anchored → normal when the user
  reaches the live bottom.

The three mechanisms that make this feel stable (prepend stabilization,
bottom-pin, above-viewport growth compensation) all depend on **measuring real
element heights** in the DOM.

## Why naive `react-window` won't work

`react-window`'s `FixedSizeList` assumes a **known, uniform row height**. Chat
messages are wildly variable height (one-liners, code blocks, image
attachments, embeds, grouped vs. ungrouped headers) and grow *after* mount when
images/embeds load. `VariableSizeList` needs an `itemSize(index)` function known
*before* render, which we don't have.

Beyond height, a drop-in windowing list breaks the load-bearing behaviors above:

- **Scroll anchoring on prepend.** react-window owns `scrollTop` and resets item
  offsets when the item array changes; prepending older pages would jump the
  viewport. Our manual `scrollHeight`-delta compensation assumes a real
  contiguous DOM, which a windowed list does not provide.
- **Text selection across messages.** Windowing unmounts off-screen rows, so a
  selection can't span beyond the rendered window, and selection anchors are lost
  on scroll.
- **Read tracking** (`useMessageVisibility`) observes real nodes; windowed rows
  that aren't mounted are never observed → messages never marked read.
- **Jump-to-message / highlight** (`highlightMessageId` + `scrollIntoView`)
  requires the target node to exist; in a windowed list it may not be mounted.

## Recommended library

Use a **dynamic-height, measure-on-render** virtualizer. Two candidates:

- **TanStack Virtual (`@tanstack/react-virtual`)** — headless, framework-idiomatic
  (we already use TanStack Query), supports dynamic measurement via
  `measureElement` / `ResizeObserver`, exposes an imperative `scrollToIndex` with
  alignment, and lets us keep full control of the scroll container. **Preferred**:
  headless means we can keep our sentinel/pagination and read-tracking model and
  slot virtualization underneath it, rather than ceding the scroll container.
- **virtua** — excellent reverse/bidirectional support and a `shift` prop
  designed for prepending items without a jump (the single hardest problem here).
  Lighter API, strong "chat" story out of the box. Worth prototyping head-to-head
  with TanStack Virtual specifically on the older-prepend case.

Both support dynamic heights and late growth via re-measurement, which is the
non-negotiable requirement. Recommendation: prototype **virtua** first for its
purpose-built prepend/reverse handling, with **TanStack Virtual** as the fallback
if we need more manual control.

## Integration risks

1. **Scroll anchor stabilization on prepend.** The single biggest risk. Today
   `useBidirectionalScroll` does `scrollTop += scrollHeightDelta`. A virtualizer
   computes offsets from an estimated total size; prepending shifts every index.
   virtua's `shift` / TanStack's `scrollToIndex` after prepend must reproduce
   *exactly* the current no-jump behavior, or history reading becomes unusable.
2. **Dynamic height + image-load reflow.** Estimated sizes are wrong until an
   element is measured; images/embeds change height post-measure. The virtualizer
   must re-measure on `ResizeObserver` (both libs can) and the above-viewport
   growth compensation must be reconciled with the virtualizer's own offset math
   — running both independently will double-compensate.
3. **Jump-to-message.** `highlightMessageId` currently relies on the node being in
   the DOM. With virtualization we must `scrollToIndex(indexOf(id), { align:
   'center' })` and only flash once the row is mounted/measured — the
   `highlightSeq` re-trigger logic has to move into that flow.
4. **Read tracking.** `useMessageVisibility` must switch from observing all nodes
   to deriving visible range from the virtualizer (it already exposes the visible
   index range), or keep observing but only the mounted subset — the "mark read"
   semantics must not regress (don't mark unmounted messages read, don't miss ones
   scrolled past quickly).
5. **Text selection.** Cross-message selection across the window boundary will
   regress. Acceptable trade-off for large lists, but call it out explicitly;
   consider an overscan large enough that typical selections stay within mounted
   rows.
6. **Anchored (jump-to-context) mode.** Two-directional loading with a centered
   start position must map onto the virtualizer's initial `scrollToIndex`.

## Suggested incremental path

1. **Don't virtualize yet where it isn't needed.** Add a message-count threshold:
   below ~200 rendered nodes, keep the current non-virtualized path (it's correct
   and battle-tested). Only switch on the virtualized renderer above the threshold.
2. **Extract a `MessageList` render-prop/child** out of `MessageContainer` so the
   scroll container, sentinels, and message mapping can be swapped without
   touching input, typing indicator, member list, or the FABs.
3. **Prototype virtua in normal mode only**, wiring its `shift`-on-prepend against
   the existing `onLoadMore`. Validate the no-jump prepend against a channel with
   thousands of messages before touching anchored mode.
4. **Reconcile the scroll-stabilization hooks**: move prepend stabilization,
   bottom-pin, and above-viewport growth compensation *into* the virtualizer's
   measurement lifecycle so there is still a single owner of `scrollTop` (the
   architectural invariant the current hook documents).
5. **Re-home read tracking** onto the virtualizer's visible range, then verify
   jump-to-message and highlight flash.
6. **Only then** port anchored mode.

Ship behind the count threshold so the risky path is opt-in and the current
correct behavior remains the default for the overwhelming majority of channels.
