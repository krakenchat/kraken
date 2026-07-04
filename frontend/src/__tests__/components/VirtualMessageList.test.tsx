import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import VirtualMessageList, {
  type VirtualMessageListHandle,
} from '../../components/Message/VirtualMessageList';
import { createMessage, resetFactoryCounter } from '../test-utils/factories';

// ── Mock virtua's VList ────────────────────────────────────────────────
// jsdom can't do real layout, so we mock VList: it renders its children into a
// plain div, installs a controllable imperative handle, and captures the props
// (shift, onScroll) so tests can drive scroll events and assert wiring.
type FakeHandle = {
  scrollToIndex: ReturnType<typeof vi.fn>;
  scrollTo: ReturnType<typeof vi.fn>;
  scrollBy: ReturnType<typeof vi.fn>;
  findItemIndex: ReturnType<typeof vi.fn>;
  getItemOffset: ReturnType<typeof vi.fn>;
  getItemSize: ReturnType<typeof vi.fn>;
  scrollOffset: number;
  scrollSize: number;
  viewportSize: number;
  cache: unknown;
};

let capturedProps: { shift?: boolean; onScroll?: (offset: number) => void } = {};
let fakeHandle: FakeHandle;

vi.mock('virtua', async () => {
  const ReactMod = await import('react');
  return {
    VList: ReactMod.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        capturedProps = props as typeof capturedProps;
        ReactMod.useImperativeHandle(ref, () => fakeHandle, []);
        return (
          <div data-testid="vlist">{props.children as React.ReactNode}</div>
        );
      },
    ),
  };
});

// ── Mock child components ──────────────────────────────────────────────
vi.mock('../../components/Message/MessageComponent', () => ({
  default: ({ message }: { message: { id: string } }) => (
    <div data-testid={`msg-${message.id}`}>message-{message.id}</div>
  ),
}));
vi.mock('../../components/Message/MessageSkeleton', () => ({
  default: () => <div data-testid="message-skeleton" />,
}));
vi.mock('../../components/Message/UnreadMessageDivider', () => ({
  UnreadMessageDivider: ({ unreadCount }: { unreadCount: number }) => (
    <div data-testid="unread-divider">{unreadCount} new messages</div>
  ),
}));

// ── Helpers ────────────────────────────────────────────────────────────
const messages = (n: number) =>
  Array.from({ length: n }, (_, i) => createMessage({ id: `msg-${i}` }));

const baseProps = {
  authorId: 'current-user',
  isLoadingMore: false,
  unreadCount: 0,
  lastReadIndex: -1,
};

function makeHandle(overrides: Partial<FakeHandle> = {}): FakeHandle {
  return {
    scrollToIndex: vi.fn(),
    scrollTo: vi.fn(),
    scrollBy: vi.fn(),
    findItemIndex: vi.fn(() => 0),
    getItemOffset: vi.fn(() => 0),
    getItemSize: vi.fn(() => 0),
    scrollOffset: 0,
    scrollSize: 1000,
    viewportSize: 400,
    cache: {},
    ...overrides,
  };
}

beforeEach(() => {
  resetFactoryCounter();
  capturedProps = {};
  fakeHandle = makeHandle();
  // Run rAF callbacks synchronously (stick-to-bottom defers via rAF).
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VirtualMessageList', () => {
  it('renders a row with data-message-id for each message', () => {
    render(<VirtualMessageList {...baseProps} orderedMessages={messages(3)} />);
    expect(document.querySelector('[data-message-id="msg-0"]')).toBeTruthy();
    expect(document.querySelector('[data-message-id="msg-1"]')).toBeTruthy();
    expect(document.querySelector('[data-message-id="msg-2"]')).toBeTruthy();
  });

  it('places the unread divider before the first unread message', () => {
    // lastReadIndex 1 → divider before index 2 (msg-2)
    render(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={messages(4)}
        unreadCount={2}
        lastReadIndex={1}
      />,
    );
    const divider = screen.getByTestId('unread-divider');
    const row2 = document.querySelector('[data-message-id="msg-2"]')!;
    // Divider is rendered inside the msg-2 row, before its message content.
    expect(row2.contains(divider)).toBe(true);
    expect(divider).toHaveTextContent('2 new messages');
  });

  it('scrolls to the newest message on initial mount', () => {
    render(<VirtualMessageList {...baseProps} orderedMessages={messages(5)} />);
    expect(fakeHandle.scrollToIndex).toHaveBeenCalledWith(4, { align: 'end' });
  });

  it('triggers onLoadMore when the visible start index nears the top', () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    fakeHandle.findItemIndex = vi.fn(() => 2); // near top
    render(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={messages(50)}
        continuationToken="next"
        onLoadMore={onLoadMore}
      />,
    );
    act(() => capturedProps.onScroll?.(50));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onLoadMore without a continuation token', () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    fakeHandle.findItemIndex = vi.fn(() => 2);
    render(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={messages(50)}
        onLoadMore={onLoadMore}
      />,
    );
    act(() => capturedProps.onScroll?.(50));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not trigger onLoadMore when far from the top', () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    fakeHandle.findItemIndex = vi.fn(() => 40); // far from top
    render(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={messages(50)}
        continuationToken="next"
        onLoadMore={onLoadMore}
      />,
    );
    act(() => capturedProps.onScroll?.(500));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('reports atBottom true near the bottom and false while scrolled up', () => {
    const onAtBottomChange = vi.fn();
    // scrollSize 1000, viewport 400 → bottom offset is 600.
    fakeHandle = makeHandle({ scrollSize: 1000, viewportSize: 400 });
    render(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={messages(50)}
        onAtBottomChange={onAtBottomChange}
      />,
    );
    onAtBottomChange.mockClear();

    act(() => capturedProps.onScroll?.(600)); // distance 0 → pinned
    expect(onAtBottomChange).toHaveBeenLastCalledWith(true);

    act(() => capturedProps.onScroll?.(100)); // distance 500 → not pinned
    expect(onAtBottomChange).toHaveBeenLastCalledWith(false);
  });

  it('reports the visible index range on scroll', () => {
    const onVisibleRangeChange = vi.fn();
    fakeHandle.findItemIndex = vi
      .fn()
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20);
    render(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={messages(50)}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    );
    act(() => capturedProps.onScroll?.(300));
    expect(onVisibleRangeChange).toHaveBeenCalledWith(10, 20);
  });

  it('sets shift=true only on the render where an older page is prepended', () => {
    const { rerender } = render(
      <VirtualMessageList {...baseProps} orderedMessages={messages(5)} />,
    );
    // Initial render: no prepend.
    expect(capturedProps.shift).toBe(false);

    // Prepend an older message (new oldest id at the start, length grows).
    const older = createMessage({ id: 'older' });
    rerender(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[older, ...messages(5)]}
      />,
    );
    expect(capturedProps.shift).toBe(true);
  });

  it('does not set shift when a newer message is appended', () => {
    const initial = messages(5);
    const { rerender } = render(
      <VirtualMessageList {...baseProps} orderedMessages={initial} />,
    );
    const newer = createMessage({ id: 'newer' });
    rerender(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[...initial, newer]}
      />,
    );
    expect(capturedProps.shift).toBe(false);
  });

  it('sticks to the bottom when a newer message arrives while pinned', () => {
    const initial = messages(5);
    const { rerender } = render(
      <VirtualMessageList {...baseProps} orderedMessages={initial} />,
    );
    // Pin to bottom via a scroll event at the bottom offset.
    act(() => capturedProps.onScroll?.(600));
    fakeHandle.scrollToIndex.mockClear();

    const newer = createMessage({ id: 'newer' });
    rerender(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[...initial, newer]}
      />,
    );
    // Scrolls to the new last index (rAF is synchronous in the test).
    expect(fakeHandle.scrollToIndex).toHaveBeenCalledWith(5, { align: 'end' });
  });

  it('does not stick to the bottom when a newer message arrives while scrolled up', () => {
    const initial = messages(5);
    const { rerender } = render(
      <VirtualMessageList {...baseProps} orderedMessages={initial} />,
    );
    act(() => capturedProps.onScroll?.(100)); // scrolled up → not pinned
    fakeHandle.scrollToIndex.mockClear();

    const newer = createMessage({ id: 'newer' });
    rerender(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[...initial, newer]}
      />,
    );
    expect(fakeHandle.scrollToIndex).not.toHaveBeenCalled();
  });

  it('exposes scrollToBottom via the imperative handle', () => {
    const ref = React.createRef<VirtualMessageListHandle>();
    render(
      <VirtualMessageList
        {...baseProps}
        ref={ref}
        orderedMessages={messages(5)}
      />,
    );
    fakeHandle.scrollToIndex.mockClear();
    act(() => ref.current?.scrollToBottom());
    expect(fakeHandle.scrollToIndex).toHaveBeenCalledWith(4, { align: 'end' });
  });
});
