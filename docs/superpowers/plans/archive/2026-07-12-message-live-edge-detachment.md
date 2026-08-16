# Message Live-Edge Detachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #404's remaining scope — when deep scrollback evicts the newest message pages (MESSAGE_MAX_PAGES cap), stop corrupting the timeline with WS-prepended messages and give the user a working "Jump to Present" path back to the live edge.

**Architecture:** The TanStack infinite message query stores `pageParams` parallel to `pages`; the live newest page is the one fetched with `pageParam === ''` (the `initialPageParam`). After cap eviction, `pageParams[0]` is an older cursor — that is the "detached from live edge" signal. A single helper (`isDetachedFromLiveEdge`) gates: (1) the WS prepend (skip when detached; reset-to-live on own messages), (2) a new normal-mode "Jump to Present" FAB that resets the query, and (3) the reconnect handler (reset detached queries instead of invalidating, since invalidate replays stored cursors and cannot recover the evicted newest page).

**Tech Stack:** React 19, TanStack Query v5 (`InfiniteData`, `resetQueries`), MUI, Vitest + Testing Library.

## Global Constraints

- ALL commands run in Docker: `docker compose run --rm frontend <cmd>` (never pnpm on host).
- Do NOT edit `frontend/src/api-client/**` (generated).
- `frontend/src/types/message.type.ts` `Message` vs generated `EnrichedMessageDto` bridge uses `as never` — follow the existing convention in `messageCacheUpdaters.ts`.
- Detached definition (use everywhere, exactly): `pageParams[0] != null && pageParams[0] !== ''`. (`undefined`/`''` both mean "live": test factories use `[undefined]`, the real query uses `''`.)
- Backend is untouched. No SDK regeneration needed.
- Empirical context (from the audit on issue #404): at the cap, TanStack evicts `pages[0]` (newest). `staleTime` is `Infinity`, so nothing self-heals; WS messages currently get prepended into the stale `pages[0]`, and the down-arrow FAB scrolls to a false bottom.

---

### Task 1: `isDetachedFromLiveEdge` helper + guard in `prependMessageToInfinite`

**Files:**
- Modify: `frontend/src/utils/messageCacheUpdaters.ts`
- Test: `frontend/src/__tests__/utils/messageCacheUpdaters.test.ts`

**Interfaces:**
- Produces: `isDetachedFromLiveEdge(data: InfiniteData<PaginatedMessagesResponseDto> | undefined): boolean` — exported from `messageCacheUpdaters.ts`. Used by Tasks 2, 3, 5.
- Produces: `prependMessageToInfinite` now returns `old` unchanged when detached.

- [ ] **Step 1: Write the failing tests** — append to the existing `describe('prependMessageToInfinite', ...)` block and add a new `describe('isDetachedFromLiveEdge', ...)` in `messageCacheUpdaters.test.ts` (reuse the file's imports/factories: `createMessage`, `createInfiniteData`, `createMultiPageInfiniteData`):

```ts
import { isDetachedFromLiveEdge } from '../../utils/messageCacheUpdaters'; // add to existing import

describe('isDetachedFromLiveEdge', () => {
  it('is false for undefined data', () => {
    expect(isDetachedFromLiveEdge(undefined)).toBe(false);
  });

  it('is false when the first page param is undefined (factory default)', () => {
    expect(isDetachedFromLiveEdge(createInfiniteData([createMessage()]))).toBe(false);
  });

  it('is false when the first page param is the empty string (live initialPageParam)', () => {
    const data = { ...createInfiniteData([createMessage()]), pageParams: [''] };
    expect(isDetachedFromLiveEdge(data)).toBe(false);
  });

  it('is true when the first page param is a cursor (newest page was evicted)', () => {
    const data = { ...createInfiniteData([createMessage()]), pageParams: ['cursor-uuid'] };
    expect(isDetachedFromLiveEdge(data)).toBe(true);
  });
});

// inside describe('prependMessageToInfinite', ...):
it('does not insert when the window is detached from the live edge', () => {
  const existing = createMessage({ id: 'old-1' });
  const data = { ...createInfiniteData([existing]), pageParams: ['cursor-uuid'] };
  const result = prependMessageToInfinite(data, createMessage({ id: 'new-1' }));
  expect(result).toBe(data); // unchanged, same reference
});
```

- [ ] **Step 2: Run to verify failure**

Run: `docker compose run --rm frontend pnpm exec vitest run src/__tests__/utils/messageCacheUpdaters.test.ts`
Expected: FAIL — `isDetachedFromLiveEdge` is not exported / new prepend test fails.

- [ ] **Step 3: Implement** in `messageCacheUpdaters.ts`:

```ts
/**
 * True when the infinite window no longer contains the live newest page.
 * The live page is fetched with pageParam '' (initialPageParam); after
 * MESSAGE_MAX_PAGES eviction the first stored param is an older cursor.
 * Test factories use `undefined` for the live page — treat both '' and
 * null/undefined as "live".
 */
export function isDetachedFromLiveEdge(
  data: InfiniteData<PaginatedMessagesResponseDto> | undefined,
): boolean {
  const first = data?.pageParams[0];
  return first != null && first !== '';
}
```

And in `prependMessageToInfinite`, after the `if (!old) return old;` line:

```ts
  // Never insert into a detached window: pages[0] is not the live newest
  // page, so prepending here would splice the message into mid-history.
  if (isDetachedFromLiveEdge(old)) return old;
```

- [ ] **Step 4: Run tests to verify pass** (same command). Expected: all messageCacheUpdaters tests PASS (existing prepend tests keep passing because factories use `pageParams: [undefined]`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/messageCacheUpdaters.ts frontend/src/__tests__/utils/messageCacheUpdaters.test.ts
git commit -m "feat(messages): add live-edge detachment detection, guard WS prepend"
```

---

### Task 2: `handleNewMessage` detached behavior (skip prepend; reset on own message)

**Files:**
- Modify: `frontend/src/socket-hub/handlers/messageHandlers.ts:39-90` (the `handleNewMessage` function)
- Test: `frontend/src/__tests__/socket-hub/handlers/messageHandlers.test.ts`

**Interfaces:**
- Consumes: `isDetachedFromLiveEdge` from Task 1.
- Behavior contract: detached + other user's message → cache untouched, unread bump still happens; detached + own message → `queryClient.resetQueries({ queryKey, exact: true })` fires and no unread bump; not detached → existing prepend behavior unchanged.

- [ ] **Step 1: Read `messageHandlers.test.ts` first** to reuse its setup helpers (it seeds a real `QueryClient` with `setQueryData` and calls handlers directly). Then write failing tests following the file's local conventions:

```ts
it('does not insert into a detached window (newest page evicted) but still bumps unread', async () => {
  // Seed channel messages cache with a detached window
  const detached = { ...createInfiniteData([createMessage({ id: 'stale-1' })]), pageParams: ['cursor-uuid'] };
  queryClient.setQueryData(channelMessagesQueryKey('chan-1'), detached);
  // Seed current user (someone else authored the incoming message)
  queryClient.setQueryData(userControllerGetProfileQueryKey(), { id: 'me' });
  queryClient.setQueryData(readReceiptsControllerGetUnreadCountsQueryKey(), [
    { channelId: 'chan-1', unreadCount: 0, mentionCount: 0 },
  ]);

  await handleNewMessage(
    { message: createMessage({ id: 'new-1', channelId: 'chan-1', authorId: 'other' }) },
    queryClient,
  );

  const after = queryClient.getQueryData(channelMessagesQueryKey('chan-1'));
  expect(after).toBe(detached); // untouched
  const unread = queryClient.getQueryData(readReceiptsControllerGetUnreadCountsQueryKey());
  expect(unread[0].unreadCount).toBe(1); // still counted
});

it('resets the query to the live edge when the DETACHED user sends their own message', async () => {
  const detached = { ...createInfiniteData([createMessage({ id: 'stale-1' })]), pageParams: ['cursor-uuid'] };
  queryClient.setQueryData(channelMessagesQueryKey('chan-1'), detached);
  queryClient.setQueryData(userControllerGetProfileQueryKey(), { id: 'me' });
  const resetSpy = vi.spyOn(queryClient, 'resetQueries');

  await handleNewMessage(
    { message: createMessage({ id: 'new-1', channelId: 'chan-1', authorId: 'me' }) },
    queryClient,
  );

  expect(resetSpy).toHaveBeenCalledWith({ queryKey: channelMessagesQueryKey('chan-1'), exact: true });
});
```

(Adapt seed/assert helpers to what the test file actually uses — e.g. if it builds the unread cache differently, follow that. The two behavioral assertions above are the requirement.)

- [ ] **Step 2: Run to verify failure**

Run: `docker compose run --rm frontend pnpm exec vitest run src/__tests__/socket-hub/handlers/messageHandlers.test.ts`
Expected: FAIL — currently the detached window gets the message prepended and no reset fires.

- [ ] **Step 3: Implement** — restructure `handleNewMessage` (keep everything else identical):

```ts
  const queryKey = messageQueryKeyForContext(message);
  if (!queryKey) return;
  const contextId = message.channelId || message.directMessageGroupId;
  if (!contextId) return;

  // At the MESSAGE_MAX_PAGES cap the newest page gets evicted and pages[0]
  // is mid-history — inserting there would corrupt the timeline (see #404).
  const existing = queryClient.getQueryData<InfiniteData<PaginatedMessagesResponseDto>>(queryKey);
  const detached = isDetachedFromLiveEdge(existing);

  if (!detached) {
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData(queryKey, (old: unknown) =>
      prependMessageToInfinite(old as never, message as Message),
    );
  }

  // Invalidate DM groups list so sidebar preview updates
  if (message.directMessageGroupId) {
    queryClient.invalidateQueries({
      queryKey: directMessagesControllerFindUserDmGroupsQueryKey(),
    });
  }

  const currentUser = queryClient.getQueryData<UserControllerGetProfileResponse>(
    userControllerGetProfileQueryKey(),
  );
  if (currentUser && message.authorId === currentUser.id) {
    // Own message while detached: sending implies "take me to the present" —
    // reset the window to the live edge (refetches the newest page).
    if (detached) {
      void queryClient.resetQueries({ queryKey, exact: true });
    }
    return;
  }

  // ... existing unread bump unchanged ...
```

Add imports: `isDetachedFromLiveEdge` from `../../utils/messageCacheUpdaters`, `type { InfiniteData }` from `@tanstack/react-query`, `type { PaginatedMessagesResponseDto }` from `../../api-client/types.gen`.

- [ ] **Step 4: Run tests to verify pass** (same command + rerun Task 1's file). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/socket-hub/handlers/messageHandlers.ts frontend/src/__tests__/socket-hub/handlers/messageHandlers.test.ts
git commit -m "feat(messages): skip WS insert into detached windows, reset on own send"
```

---

### Task 3: `useMessages` exposes `isDetachedFromPresent` + `resetToPresent`

**Files:**
- Modify: `frontend/src/hooks/useMessages.ts`
- Test: Create `frontend/src/__tests__/hooks/useMessages.detachment.test.tsx`

**Interfaces:**
- Consumes: `isDetachedFromLiveEdge` from Task 1.
- Produces (added to the hook's return object; consumed by Task 4):
  - `isDetachedFromPresent: boolean`
  - `resetToPresent: () => Promise<void>`

- [ ] **Step 1: Write the failing test.** Use `renderHook` with a `QueryClientProvider` wrapper and a pre-seeded cache (no network needed since `staleTime: Infinity` keeps seeded data fresh — but note `resetToPresent` triggers a refetch, so mock the SDK module):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMessages } from '../../hooks/useMessages';
import { channelMessagesQueryKey } from '../../utils/messageQueryKeys';
import { createMessage, createInfiniteData } from '../test-utils';

vi.mock('../../api-client/sdk.gen', () => ({
  messagesControllerFindAllForChannel: vi.fn(async () => ({
    data: { messages: [], continuationToken: '' },
  })),
  messagesControllerFindAllForGroup: vi.fn(async () => ({
    data: { messages: [], continuationToken: '' },
  })),
}));

const setup = (seed: unknown) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(channelMessagesQueryKey('chan-1'), seed);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

describe('useMessages live-edge detachment', () => {
  it('reports not detached when the first page param is the live edge', () => {
    const { wrapper } = setup(createInfiniteData([createMessage()]));
    const { result } = renderHook(() => useMessages('channel', 'chan-1'), { wrapper });
    expect(result.current.isDetachedFromPresent).toBe(false);
  });

  it('reports detached when the first page param is a cursor', () => {
    const seed = { ...createInfiniteData([createMessage()]), pageParams: ['cursor-uuid'] };
    const { wrapper } = setup(seed);
    const { result } = renderHook(() => useMessages('channel', 'chan-1'), { wrapper });
    expect(result.current.isDetachedFromPresent).toBe(true);
  });

  it('resetToPresent resets the query (window returns to the live edge)', async () => {
    const seed = { ...createInfiniteData([createMessage()]), pageParams: ['cursor-uuid'] };
    const { queryClient, wrapper } = setup(seed);
    const resetSpy = vi.spyOn(queryClient, 'resetQueries');
    const { result } = renderHook(() => useMessages('channel', 'chan-1'), { wrapper });
    await result.current.resetToPresent();
    expect(resetSpy).toHaveBeenCalledWith({ queryKey: channelMessagesQueryKey('chan-1'), exact: true });
  });
});
```

(If the app's default test setup already mocks the api-client globally via MSW, follow that pattern instead — check `frontend/src/__tests__/test-utils/` and neighboring hook tests before inventing new mocking.)

- [ ] **Step 2: Run to verify failure**

Run: `docker compose run --rm frontend pnpm exec vitest run src/__tests__/hooks/useMessages.detachment.test.tsx`
Expected: FAIL — `isDetachedFromPresent`/`resetToPresent` are undefined.

- [ ] **Step 3: Implement** in `useMessages.ts`:

```ts
import { useQueryClient } from "@tanstack/react-query"; // add to existing import
import { isDetachedFromLiveEdge } from "../utils/messageCacheUpdaters";

// inside the hook, after the useInfiniteQuery call:
  const queryClient = useQueryClient();

  // True when deep scrollback evicted the newest page (MESSAGE_MAX_PAGES cap):
  // the loaded window no longer contains the live edge (#404).
  const isDetachedFromPresent = isDetachedFromLiveEdge(data);

  const resetToPresent = useCallback(async () => {
    if (!id) return;
    const key = type === 'channel' ? channelMessagesQueryKey(id) : dmMessagesQueryKey(id);
    await queryClient.resetQueries({ queryKey: key, exact: true });
  }, [queryClient, type, id]);

// and add to the returned object:
    isDetachedFromPresent,
    resetToPresent,
```

- [ ] **Step 4: Run tests to verify pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useMessages.ts frontend/src/__tests__/hooks/useMessages.detachment.test.tsx
git commit -m "feat(messages): expose live-edge detachment state from useMessages"
```

---

### Task 4: "Jump to Present" FAB in normal mode (plumbing + UI)

**Files:**
- Modify: `frontend/src/components/Message/MessageContainerWrapper.tsx` (interface `MessagesHookResult` ~lines 15-31, destructure ~line 80-93, pass-through ~line 117-130)
- Modify: `frontend/src/components/Message/MessageContainer.tsx` (props interface lines 16-58, destructure lines 60-85, FAB block lines 378-410)
- Test: `frontend/src/__tests__/components/MessageContainer.test.tsx`

**Interfaces:**
- Consumes: `isDetachedFromPresent: boolean` and `resetToPresent: () => Promise<void>` flowing from `useMessages` (Task 3) through `useJumpToMessage`'s result spread (no change needed there — it spreads `activeResult`) into `MessageContainerWrapper`'s `useMessagesHook()` result.
- Produces: MessageContainer renders the extended "Jump to Present" FAB (`data-testid="jump-to-present-fab"`) in normal mode whenever detached — regardless of `atBottom`, because the loaded bottom is a false present.

- [ ] **Step 1: Read `MessageContainer.test.tsx`'s existing setup** (it's 42KB — find how it builds `baseProps` and asserts on FABs; the anchored-mode tests target `jump-to-present-fab`). Write failing tests in its style:

```tsx
it('shows Jump to Present in normal mode when detached from the live edge, even at bottom', () => {
  const resetToPresent = vi.fn(() => Promise.resolve());
  renderWithProviders(
    <MessageContainer
      {...baseProps}
      mode="normal"
      isDetachedFromPresent
      resetToPresent={resetToPresent}
    />,
  );
  expect(screen.getByTestId('jump-to-present-fab')).toBeInTheDocument();
});

it('clicking Jump to Present resets the window to the live edge', async () => {
  const resetToPresent = vi.fn(() => Promise.resolve());
  const { user } = renderWithProviders(
    <MessageContainer
      {...baseProps}
      mode="normal"
      isDetachedFromPresent
      resetToPresent={resetToPresent}
    />,
  );
  await user.click(screen.getByTestId('jump-to-present-fab'));
  expect(resetToPresent).toHaveBeenCalled();
});

it('does not show Jump to Present in normal mode when not detached', () => {
  renderWithProviders(
    <MessageContainer {...baseProps} mode="normal" isDetachedFromPresent={false} />,
  );
  expect(screen.queryByTestId('jump-to-present-fab')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `docker compose run --rm frontend pnpm exec vitest run src/__tests__/components/MessageContainer.test.tsx`
Expected: the three new tests FAIL (no such props / FAB absent).

- [ ] **Step 3: Implement.**

`MessageContainer.tsx` — add props:

```ts
  // Live-edge detachment (normal mode): deep scrollback evicted the newest
  // page, so the loaded bottom is not the present (#404).
  isDetachedFromPresent?: boolean;
  resetToPresent?: () => Promise<void>;
```

Add handler near `scrollToBottom` (lines ~139-144). `scrollToBottom`'s identity changes when the renderer switches (reset shrinks the list below the virtualization threshold), so go through a ref:

```ts
  const scrollToBottomRef = useRef(scrollToBottom);
  useLayoutEffect(() => {
    scrollToBottomRef.current = scrollToBottom;
  });

  const handleDetachedJumpToPresent = useCallback(() => {
    void resetToPresent?.().then(() => {
      // Two frames: one for the query reset to commit, one for the
      // (possible) virtual→legacy renderer switch to mount.
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottomRef.current()));
    });
  }, [resetToPresent]);
```

Replace the FAB block (lines 378-410) with a three-way branch — the anchored FAB stays byte-identical, insert the detached branch between it and the plain FAB:

```tsx
        {mode === 'anchored' && jumpToPresent ? (
          /* ...existing anchored FAB unchanged... */
        ) : mode === 'normal' && isDetachedFromPresent && resetToPresent ? (
          <Fab
            variant="extended"
            size="small"
            onClick={handleDetachedJumpToPresent}
            data-testid="jump-to-present-fab"
            sx={{
              position: "absolute",
              bottom: 80,
              right: 16,
              backgroundColor: "primary.main",
              "&:hover": { backgroundColor: "primary.dark" },
              color: "primary.contrastText",
            }}
          >
            <KeyboardArrowDownIcon sx={{ mr: 0.5 }} />
            Jump to Present
          </Fab>
        ) : !atBottom && (
          /* ...existing plain FAB unchanged... */
        )}
```

`MessageContainerWrapper.tsx` — add to the `MessagesHookResult` interface:

```ts
  isDetachedFromPresent?: boolean;
  resetToPresent?: () => Promise<void>;
```

destructure them from `useMessagesHook()` and pass to `<MessageContainer ... isDetachedFromPresent={isDetachedFromPresent} resetToPresent={resetToPresent} />`.

- [ ] **Step 4: Run tests to verify pass** (same command; whole file — existing FAB tests must stay green). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Message/MessageContainer.tsx frontend/src/components/Message/MessageContainerWrapper.tsx frontend/src/__tests__/components/MessageContainer.test.tsx
git commit -m "feat(messages): Jump to Present FAB when detached from live edge"
```

---

### Task 5: Reconnect handler resets detached windows

**Files:**
- Modify: `frontend/src/socket-hub/handlers/reconnectHandlers.ts:12-19`
- Test: `frontend/src/__tests__/socket-hub/handlers/reconnectHandlers.test.ts`

**Interfaces:**
- Consumes: `isDetachedFromLiveEdge` from Task 1.
- Behavior contract: on reconnect, message queries whose window is detached get `resetQueries` (recovers the live edge); live-edge windows keep the existing `invalidateQueries` behavior.

- [ ] **Step 1: Read `reconnectHandlers.test.ts`** (3KB) and add failing tests in its style:

```ts
it('resets detached message queries instead of invalidating them', () => {
  const detached = { ...createInfiniteData([createMessage()]), pageParams: ['cursor-uuid'] };
  queryClient.setQueryData(channelMessagesQueryKey('chan-detached'), detached);
  const live = createInfiniteData([createMessage()]);
  queryClient.setQueryData(channelMessagesQueryKey('chan-live'), live);
  const resetSpy = vi.spyOn(queryClient, 'resetQueries');

  handleReconnect(queryClient);

  expect(resetSpy).toHaveBeenCalledWith({ queryKey: channelMessagesQueryKey('chan-detached'), exact: true });
  // live window: not reset (still handled by invalidation)
  expect(resetSpy).not.toHaveBeenCalledWith({ queryKey: channelMessagesQueryKey('chan-live'), exact: true });
  expect(queryClient.getQueryState(channelMessagesQueryKey('chan-live'))?.isInvalidated).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `docker compose run --rm frontend pnpm exec vitest run src/__tests__/socket-hub/handlers/reconnectHandlers.test.ts`
Expected: FAIL — no reset happens today.

- [ ] **Step 3: Implement** — replace the two message `invalidateQueries` calls (lines 13-19) with:

```ts
  // Messages. A detached window (newest page evicted at MESSAGE_MAX_PAGES)
  // cannot be recovered by invalidation — the refetch replays the stored
  // cursors, which no longer include the live edge. Reset those instead.
  for (const _id of [
    'messagesControllerFindAllForChannel',
    'messagesControllerFindAllForGroup',
  ]) {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: [{ _id }] })) {
      const data = query.state.data as
        | InfiniteData<PaginatedMessagesResponseDto>
        | undefined;
      if (isDetachedFromLiveEdge(data)) {
        void queryClient.resetQueries({ queryKey: query.queryKey, exact: true });
      } else {
        void queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true });
      }
    }
  }
```

Imports: `isDetachedFromLiveEdge` from `../../utils/messageCacheUpdaters`, `type { InfiniteData }` from `@tanstack/react-query`, `type { PaginatedMessagesResponseDto }` from `../../api-client/types.gen`.

- [ ] **Step 4: Run tests to verify pass** (same command; existing reconnect tests must stay green — note they may assert the old blanket invalidation; update those assertions only if the behavior they check is the one intentionally changed here).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/socket-hub/handlers/reconnectHandlers.ts frontend/src/__tests__/socket-hub/handlers/reconnectHandlers.test.ts
git commit -m "feat(messages): reset detached message windows on socket reconnect"
```

---

### Task 6: Full suite + lint gate

- [ ] **Step 1:** `docker compose run --rm frontend pnpm run test` — Expected: all files pass (baseline before this work: 160 files / 1678 tests, all green).
- [ ] **Step 2:** `docker compose run --rm frontend pnpm run lint` — Expected: 0 errors (warnings pre-exist).
- [ ] **Step 3:** Fix anything red, rerun, commit fixes if any.

---

### Task 7: Browser verification (main session — not a subagent task)

Uses the seeded dev channel from the audit (`#general`, 1301+ messages, channel id `e9c12304-afdf-48ec-9547-8cb4e734dfce`).

- [ ] Scroll back past the cap (loaded window slides, newest evicted) as `admin`; verify `pageParams[0]` is a cursor via devtools/eval → the **Jump to Present FAB appears**.
- [ ] Have `user-0` send a message via the composer → admin's cache is NOT modified (no mid-history splice), unread count bumps.
- [ ] Click Jump to Present → window resets to the live newest page; the new message is at the bottom; timeline contiguous.
- [ ] As a detached user, SEND a message → window resets to present automatically and the sent message is visible.
