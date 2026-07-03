import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import MessageContainer from '../../components/Message/MessageContainer';
import { createMessage, resetFactoryCounter } from '../test-utils/factories';

// ── Mock IntersectionObserver ──────────────────────────────────────────
type MockObserverInstance = {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  elements: Set<Element>;
  observe: Mock<(el: Element) => void>;
  unobserve: Mock<(el: Element) => void>;
  disconnect: Mock<() => void>;
  trigger: (entries: Partial<IntersectionObserverEntry>[]) => void;
};

let mockObserverInstances: MockObserverInstance[] = [];

class MockIntersectionObserver {
  _instance: MockObserverInstance;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    const instance: MockObserverInstance = {
      callback,
      options,
      elements: new Set(),
      observe: vi.fn((el: Element) => { instance.elements.add(el); }),
      unobserve: vi.fn((el: Element) => { instance.elements.delete(el); }),
      disconnect: vi.fn(() => { instance.elements.clear(); }),
      trigger: (entries: Partial<IntersectionObserverEntry>[]) => {
        callback(
          entries as IntersectionObserverEntry[],
          this as unknown as IntersectionObserver,
        );
      },
    };
    this._instance = instance;
    mockObserverInstances.push(instance);
  }
  observe(el: Element) { this._instance.observe(el); }
  unobserve(el: Element) { this._instance.unobserve(el); }
  disconnect() { this._instance.disconnect(); }
}

// ── Mock ResizeObserver ────────────────────────────────────────────────
type MockResizeInstance = {
  callback: ResizeObserverCallback;
  elements: Set<Element>;
  trigger: (targets: Element[]) => void;
};

let mockResizeInstances: MockResizeInstance[] = [];

class MockResizeObserver {
  _instance: MockResizeInstance;
  constructor(callback: ResizeObserverCallback) {
    const instance: MockResizeInstance = {
      callback,
      elements: new Set(),
      trigger: (targets: Element[]) => {
        callback(
          targets.map((target) => ({ target }) as ResizeObserverEntry),
          this as unknown as ResizeObserver,
        );
      },
    };
    this._instance = instance;
    mockResizeInstances.push(instance);
  }
  observe(el: Element) { this._instance.elements.add(el); }
  unobserve(el: Element) { this._instance.elements.delete(el); }
  disconnect() { this._instance.elements.clear(); }
}

// ── Mock child components ──────────────────────────────────────────────
vi.mock('../../components/Message/MessageComponent', () => ({
  default: ({ message, isSearchHighlight, contextType }: { message: { id: string; spans: unknown[] }; isSearchHighlight?: boolean; contextType?: string }) => (
    <div data-testid={`message-${message.id}`} data-highlighted={isSearchHighlight} data-context-type={contextType}>
      message-{message.id}
    </div>
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

// ── Mock hooks ─────────────────────────────────────────────────────────
const mockMarkAsRead = vi.fn();
vi.mock('../../hooks/useMessageVisibility', () => ({
  useMessageVisibility: () => ({ markAsRead: mockMarkAsRead }),
}));

const mockGetLastReadMessageId = vi.fn((): string | undefined => undefined);
const mockGetUnreadCount = vi.fn((): number => 0);
vi.mock('../../hooks/useReadReceipts', () => ({
  useReadReceipts: () => ({
    lastReadMessageId: mockGetLastReadMessageId,
    unreadCount: mockGetUnreadCount,
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────
const defaultProps = {
  messages: [] as ReturnType<typeof createMessage>[],
  isLoading: false,
  error: null,
  authorId: 'current-user-1',
  isLoadingMore: false,
  messageInput: <div data-testid="message-input">input</div>,
};

/** Find the message scroll container */
function getScrollContainer() {
  return screen.getByTestId('scroll-container');
}

/**
 * Make scroll geometry mockable on a jsdom element: writable scrollTop plus
 * configurable scrollHeight/clientHeight.
 */
function mockScrollGeometry(
  el: HTMLElement,
  { scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = {},
) {
  let top = scrollTop;
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => { top = v; },
  });
  const setScrollHeight = (v: number) =>
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => v });
  setScrollHeight(scrollHeight);
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
  return { setScrollHeight };
}

/** Get the IntersectionObserver instance that observes a given element */
function findObserverFor(testFn: (instance: MockObserverInstance) => boolean) {
  return mockObserverInstances.find(testFn);
}

/** Get the most recent ResizeObserver instance that observes a given element */
function findResizeObserverFor(el: Element) {
  return [...mockResizeInstances].reverse().find((inst) => inst.elements.has(el));
}

/** Build a partial DOMRect for getBoundingClientRect mocks */
function makeRect({ top = 0, height = 0 }: { top?: number; height?: number }) {
  return {
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

// ── Setup / Teardown ───────────────────────────────────────────────────
beforeEach(() => {
  resetFactoryCounter();
  mockObserverInstances = [];
  mockResizeInstances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  mockGetLastReadMessageId.mockReturnValue(undefined);
  mockGetUnreadCount.mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────
describe('MessageContainer', () => {
  // ── Loading / Error / Empty states ─────────────────────────────────
  describe('loading state', () => {
    it('renders loading skeletons when isLoading is true', () => {
      renderWithProviders(<MessageContainer {...defaultProps} isLoading={true} />);

      const skeletons = screen.getAllByTestId('message-skeleton');
      expect(skeletons.length).toBe(10);
    });
  });

  describe('error state', () => {
    it('renders error message when error is set', () => {
      renderWithProviders(
        <MessageContainer {...defaultProps} error={new Error('fail')} />,
      );

      expect(screen.getByText('Error loading messages')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders default empty message when no messages', () => {
      renderWithProviders(<MessageContainer {...defaultProps} />);

      expect(
        screen.getByText('No messages yet. Start the conversation!'),
      ).toBeInTheDocument();
    });

    it('renders custom empty state message', () => {
      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          emptyStateMessage="Nothing here yet!"
        />,
      );

      expect(screen.getByText('Nothing here yet!')).toBeInTheDocument();
    });
  });

  // ── Message rendering ──────────────────────────────────────────────
  describe('message rendering', () => {
    it('renders all messages', () => {
      const messages = [
        createMessage({ id: 'msg-a' }),
        createMessage({ id: 'msg-b' }),
        createMessage({ id: 'msg-c' }),
      ];

      renderWithProviders(
        <MessageContainer {...defaultProps} messages={messages} />,
      );

      expect(screen.getByTestId('message-msg-a')).toBeInTheDocument();
      expect(screen.getByTestId('message-msg-b')).toBeInTheDocument();
      expect(screen.getByTestId('message-msg-c')).toBeInTheDocument();
    });

    it('renders scroll container as a normal column', () => {
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer {...defaultProps} messages={messages} />,
      );

      const container = getScrollContainer();
      expect(container).toBeInTheDocument();
      expect(container).toHaveStyle({ flexDirection: 'column' });
    });

    it('renders messages in chronological DOM order (oldest first) given newest-first input', () => {
      // Regression test for the cross-message text selection bug: native
      // selection follows DOM order, so the DOM must be chronological even
      // though the messages prop arrives newest-first.
      const messages = [
        createMessage({ id: 'msg-newest' }),
        createMessage({ id: 'msg-middle' }),
        createMessage({ id: 'msg-oldest' }),
      ];

      renderWithProviders(
        <MessageContainer {...defaultProps} messages={messages} />,
      );

      const container = getScrollContainer();
      const rendered = Array.from(
        container.querySelectorAll('[data-testid^="message-msg-"]'),
      ).map((el) => el.getAttribute('data-testid'));

      expect(rendered).toEqual([
        'message-msg-oldest',
        'message-msg-middle',
        'message-msg-newest',
      ]);
    });

    it('bottom-packs sparse content: first child of the scroll container has marginTop auto', () => {
      // Replaces column-reverse's bottom packing: when messages don't fill
      // the viewport, the auto top margin on the first child absorbs the free
      // space so content sits at the visual bottom. (justifyContent: flex-end
      // is NOT an acceptable substitute — it breaks scrolling in some engines.)
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer {...defaultProps} messages={messages} />,
      );

      const container = getScrollContainer();
      expect(container.firstElementChild).toHaveStyle({ marginTop: 'auto' });
    });

    it('always renders message input outside the scroll container', () => {
      renderWithProviders(<MessageContainer {...defaultProps} />);

      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });
  });

  // ── Scroll-to-bottom FAB ───────────────────────────────────────────
  describe('scroll-to-bottom FAB', () => {
    it('does not show FAB initially (atBottom defaults to true)', () => {
      const messages = [createMessage({ id: 'msg-1' })];
      renderWithProviders(
        <MessageContainer {...defaultProps} messages={messages} />,
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows FAB when bottom sentinel reports not intersecting', () => {
      const messages = [createMessage({ id: 'msg-1' })];
      renderWithProviders(
        <MessageContainer {...defaultProps} messages={messages} />,
      );

      // Find the observer watching the bottom sentinel (threshold: 0)
      const bottomObserver = findObserverFor(
        (inst) => inst.options?.threshold === 0 && inst.elements.size > 0,
      );
      expect(bottomObserver).toBeDefined();

      // Simulate scrolling away from bottom
      act(() => {
        bottomObserver!.trigger([{ isIntersecting: false }]);
      });

      // FAB should now be visible
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('scrolls to the container scrollHeight when FAB is clicked', async () => {
      const messages = [createMessage({ id: 'msg-1' })];
      const { user } = renderWithProviders(
        <MessageContainer {...defaultProps} messages={messages} />,
      );

      const container = getScrollContainer();
      container.scrollTo = vi.fn();

      // Make FAB visible
      const bottomObserver = findObserverFor(
        (inst) => inst.options?.threshold === 0 && inst.elements.size > 0,
      );
      act(() => {
        bottomObserver!.trigger([{ isIntersecting: false }]);
      });

      await user.click(screen.getByRole('button'));
      // Visual bottom in a normal column is scrollTop = scrollHeight
      // (0 in jsdom, but asserted against the element's own value).
      expect(container.scrollTo).toHaveBeenCalledWith({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    });

    it('hides FAB when bottom sentinel becomes visible again', () => {
      const messages = [createMessage({ id: 'msg-1' })];
      renderWithProviders(
        <MessageContainer {...defaultProps} messages={messages} />,
      );

      const bottomObserver = findObserverFor(
        (inst) => inst.options?.threshold === 0 && inst.elements.size > 0,
      );

      // Scroll away then back
      act(() => {
        bottomObserver!.trigger([{ isIntersecting: false }]);
      });
      expect(screen.getByRole('button')).toBeInTheDocument();

      act(() => {
        bottomObserver!.trigger([{ isIntersecting: true }]);
      });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  // ── Pagination (load more) ────────────────────────────────────────
  describe('pagination', () => {
    it('calls onLoadMore when top sentinel is intersecting', () => {
      const onLoadMore = vi.fn().mockResolvedValue(undefined);
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          continuationToken="next-page-token"
          onLoadMore={onLoadMore}
        />,
      );

      // threshold=0 observers: bottom sentinel (1st) and top sentinel (2nd)
      const thresholdZeroObservers = mockObserverInstances.filter(
        (inst) => inst.options?.threshold === 0,
      );
      expect(thresholdZeroObservers.length).toBeGreaterThanOrEqual(2);

      act(() => {
        thresholdZeroObservers[1].trigger([{ isIntersecting: true }]);
      });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('does not call onLoadMore when isLoadingMore is true', () => {
      const onLoadMore = vi.fn().mockResolvedValue(undefined);
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          continuationToken="token"
          onLoadMore={onLoadMore}
          isLoadingMore={true}
        />,
      );

      const thresholdZeroObservers = mockObserverInstances.filter(
        (inst) => inst.options?.threshold === 0,
      );
      expect(thresholdZeroObservers.length).toBeGreaterThanOrEqual(2);

      act(() => {
        thresholdZeroObservers[1].trigger([{ isIntersecting: true }]);
      });
      expect(onLoadMore).not.toHaveBeenCalled();
    });

    it('does not call onLoadMore without continuationToken', () => {
      const onLoadMore = vi.fn().mockResolvedValue(undefined);
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          onLoadMore={onLoadMore}
        />,
      );

      const thresholdZeroObservers = mockObserverInstances.filter(
        (inst) => inst.options?.threshold === 0,
      );
      expect(thresholdZeroObservers.length).toBeGreaterThanOrEqual(2);

      act(() => {
        thresholdZeroObservers[1].trigger([{ isIntersecting: true }]);
      });
      expect(onLoadMore).not.toHaveBeenCalled();
    });

    it('shows loading skeletons when isLoadingMore is true', () => {
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          isLoadingMore={true}
        />,
      );

      // 3 skeletons shown during loading more (in addition to the message)
      const skeletons = screen.getAllByTestId('message-skeleton');
      expect(skeletons.length).toBe(3);
    });
  });

  // ── Scroll anchoring ───────────────────────────────────────────────
  describe('scroll anchoring', () => {
    it('sticks to bottom when a new message arrives while pinned', () => {
      const m1 = createMessage({ id: 'msg-1' });
      const m2 = createMessage({ id: 'msg-2' });
      const { rerender } = renderWithProviders(
        <MessageContainer {...defaultProps} messages={[m2, m1]} />,
      );

      const container = getScrollContainer();
      mockScrollGeometry(container, {
        scrollTop: 600,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      // distance from bottom = 1000 - 600 - 400 = 0 → pinned
      fireEvent.scroll(container);

      // A new newest message arrives (prop is newest-first)
      const m3 = createMessage({ id: 'msg-3' });
      rerender(<MessageContainer {...defaultProps} messages={[m3, m2, m1]} />);

      expect(container.scrollTop).toBe(1000);
    });

    it('does not move the viewport for a new message while reading history', () => {
      const m1 = createMessage({ id: 'msg-1' });
      const m2 = createMessage({ id: 'msg-2' });
      const { rerender } = renderWithProviders(
        <MessageContainer {...defaultProps} messages={[m2, m1]} />,
      );

      const container = getScrollContainer();
      mockScrollGeometry(container, {
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      // distance from bottom = 500 → not pinned
      fireEvent.scroll(container);

      const m3 = createMessage({ id: 'msg-3' });
      rerender(<MessageContainer {...defaultProps} messages={[m3, m2, m1]} />);

      expect(container.scrollTop).toBe(100);
    });

    it('adjusts scrollTop when an older page is prepended', () => {
      const m1 = createMessage({ id: 'msg-1' });
      const m2 = createMessage({ id: 'msg-2' });
      const { rerender } = renderWithProviders(
        <MessageContainer {...defaultProps} messages={[m2, m1]} />,
      );

      const container = getScrollContainer();
      const { setScrollHeight } = mockScrollGeometry(container, {
        scrollTop: 500,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      // distance from bottom = 100 → not pinned (reading history)
      fireEvent.scroll(container);

      // Re-render with a fresh array identity (same content) so the
      // stabilization effect records the 1000px baseline scrollHeight.
      rerender(<MessageContainer {...defaultProps} messages={[m2, m1]} />);

      // Older page arrives: appended to the newest-first prop, which renders
      // as a prepend at the top of the chronological DOM.
      setScrollHeight(1300);
      const m0 = createMessage({ id: 'msg-0' });
      rerender(
        <MessageContainer {...defaultProps} messages={[m2, m1, m0]} />,
      );

      // scrollTop shifted by the 300px height delta → viewport stays put
      expect(container.scrollTop).toBe(800);
    });

    it('does not yank to bottom when a newer page arrives while pinned in anchored mode', () => {
      const m1 = createMessage({ id: 'msg-1' });
      const m2 = createMessage({ id: 'msg-2' });
      const { rerender } = renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={[m2, m1]}
          mode="anchored"
          hasNewer={true}
        />,
      );

      const container = getScrollContainer();
      mockScrollGeometry(container, {
        scrollTop: 600,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      // distance from bottom = 0 → pinnedToBottomRef becomes true
      fireEvent.scroll(container);

      // The bottom-pin ResizeObserver must not observe the container in
      // anchored mode: it is recreated on message changes and its initial
      // callbacks fire with stale pinned=true, which would teleport the user.
      expect(
        mockResizeInstances.some((inst) => inst.elements.has(container)),
      ).toBe(false);

      // A newer page lands: a newer newest message appends below the viewport
      const m3 = createMessage({ id: 'msg-3' });
      rerender(
        <MessageContainer
          {...defaultProps}
          messages={[m3, m2, m1]}
          mode="anchored"
          hasNewer={true}
        />,
      );

      // Viewport must stay put — NOT be forced to scrollHeight
      expect(container.scrollTop).toBe(600);
    });

    it('compensates scrollTop when content above the viewport grows while unpinned', () => {
      const m1 = createMessage({ id: 'msg-1' });
      const m2 = createMessage({ id: 'msg-2' });
      renderWithProviders(
        <MessageContainer {...defaultProps} messages={[m2, m1]} />,
      );

      const container = getScrollContainer();
      mockScrollGeometry(container, {
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      // distance from bottom = 500 → not pinned (reading history)
      fireEvent.scroll(container);
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(
        makeRect({ top: 0, height: 400 }),
      );

      // msg-1 sits above the viewport (top edge above the container's top)
      const el = document.querySelector('[data-message-id="msg-1"]') as HTMLElement;
      const rectSpy = vi
        .spyOn(el, 'getBoundingClientRect')
        .mockReturnValue(makeRect({ top: -250, height: 200 }));

      const growthObserver = findResizeObserverFor(el);
      expect(growthObserver).toBeDefined();

      // First callback only records the baseline height — no compensation
      act(() => {
        growthObserver!.trigger([el]);
      });
      expect(container.scrollTop).toBe(100);

      // Media finishes loading: the element grows by 300px above the viewport
      rectSpy.mockReturnValue(makeRect({ top: -250, height: 500 }));
      act(() => {
        growthObserver!.trigger([el]);
      });
      expect(container.scrollTop).toBe(400);
    });

    it('skips above-viewport growth compensation while pinned to the bottom', () => {
      const m1 = createMessage({ id: 'msg-1' });
      const m2 = createMessage({ id: 'msg-2' });
      renderWithProviders(
        <MessageContainer {...defaultProps} messages={[m2, m1]} />,
      );

      const container = getScrollContainer();
      mockScrollGeometry(container, {
        scrollTop: 600,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      // distance from bottom = 0 → pinned
      fireEvent.scroll(container);
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(
        makeRect({ top: 0, height: 400 }),
      );

      const el = document.querySelector('[data-message-id="msg-1"]') as HTMLElement;
      const rectSpy = vi
        .spyOn(el, 'getBoundingClientRect')
        .mockReturnValue(makeRect({ top: -250, height: 200 }));

      const growthObserver = findResizeObserverFor(el);
      expect(growthObserver).toBeDefined();

      act(() => {
        growthObserver!.trigger([el]);
      });
      rectSpy.mockReturnValue(makeRect({ top: -250, height: 500 }));
      act(() => {
        growthObserver!.trigger([el]);
      });

      // No compensation increment — while pinned, the bottom-pin observer
      // (a separate mechanism) owns keeping the view glued to the bottom.
      expect(container.scrollTop).toBe(600);
    });
  });

  // ── Unread message divider ─────────────────────────────────────────
  describe('unread message divider', () => {
    it('shows divider at the correct position', () => {
      // Messages newest-first: msg-a (newest), msg-b, msg-c (oldest)
      // msg-c is the last read message (index 2 in newest-first)
      const messages = [
        createMessage({ id: 'msg-a' }),
        createMessage({ id: 'msg-b' }),
        createMessage({ id: 'msg-c' }),
      ];

      mockGetLastReadMessageId.mockReturnValue('msg-c');
      mockGetUnreadCount.mockReturnValue(2);

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          channelId="channel-1"
        />,
      );

      const divider = screen.getByTestId('unread-divider');
      expect(divider).toHaveTextContent('2 new messages');

      // Verify DOM order: rendering is chronological (oldest first), so the
      // DOM is msg-c (last read), divider, msg-b, msg-a — placing the divider
      // between the last-read message and the first unread one.
      const container = getScrollContainer();
      const children = Array.from(container.querySelectorAll('[data-testid]'));
      const testIds = children.map((el) => el.getAttribute('data-testid'));
      const dividerIdx = testIds.indexOf('unread-divider');
      const msgBIdx = testIds.indexOf('message-msg-b');
      const msgCIdx = testIds.indexOf('message-msg-c');
      expect(dividerIdx).toBeGreaterThan(msgCIdx);
      expect(dividerIdx).toBeLessThan(msgBIdx);
    });

    it('does not show divider when unreadCount is 0', () => {
      const messages = [
        createMessage({ id: 'msg-a' }),
        createMessage({ id: 'msg-b' }),
      ];

      mockGetLastReadMessageId.mockReturnValue('msg-b');
      mockGetUnreadCount.mockReturnValue(0);

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          channelId="channel-1"
        />,
      );

      expect(screen.queryByTestId('unread-divider')).not.toBeInTheDocument();
    });

    it('does not show divider when last read message is the newest', () => {
      const messages = [
        createMessage({ id: 'msg-a' }),
        createMessage({ id: 'msg-b' }),
      ];

      // Last read is the newest message — nothing is unread in view
      mockGetLastReadMessageId.mockReturnValue('msg-a');
      mockGetUnreadCount.mockReturnValue(0);

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          channelId="channel-1"
        />,
      );

      expect(screen.queryByTestId('unread-divider')).not.toBeInTheDocument();
    });
  });

  // ── Highlighted message ────────────────────────────────────────────
  describe('highlighted message', () => {
    beforeEach(() => {
      // scrollIntoView is not implemented in jsdom; mock it globally
      Element.prototype.scrollIntoView = vi.fn();
    });

    it('marks the correct message as highlighted', () => {
      const messages = [
        createMessage({ id: 'msg-a' }),
        createMessage({ id: 'msg-b' }),
      ];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          highlightMessageId="msg-b"
        />,
      );

      expect(screen.getByTestId('message-msg-b')).toHaveAttribute(
        'data-highlighted',
        'true',
      );
      expect(screen.getByTestId('message-msg-a')).toHaveAttribute(
        'data-highlighted',
        'false',
      );
    });

    it('calls scrollIntoView on the highlighted message element', async () => {
      const messages = [
        createMessage({ id: 'msg-a' }),
        createMessage({ id: 'msg-b' }),
      ];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          highlightMessageId="msg-b"
          highlightSeq={1}
        />,
      );

      const msgEl = document.querySelector('[data-message-id="msg-b"]')!;

      await waitFor(() => {
        expect(msgEl.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'instant',
          block: 'center',
        });
      });
    });
  });

  // ── Member list ────────────────────────────────────────────────────
  describe('member list', () => {
    it('renders member list when provided and showMemberList is true', () => {
      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          memberListComponent={<div data-testid="member-list">Members</div>}
          showMemberList={true}
        />,
      );

      expect(screen.getByTestId('member-list')).toBeInTheDocument();
    });

    it('does not render member list when showMemberList is false', () => {
      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          memberListComponent={<div data-testid="member-list">Members</div>}
          showMemberList={false}
        />,
      );

      expect(screen.queryByTestId('member-list')).not.toBeInTheDocument();
    });
  });

  // ── Anchored mode (jump to message) ──────────────────────────────
  describe('anchored mode', () => {
    it('shows "Jump to Present" button in anchored mode', () => {
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          mode="anchored"
          jumpToPresent={vi.fn()}
        />,
      );

      expect(screen.getByTestId('jump-to-present-fab')).toBeInTheDocument();
      expect(screen.getByText('Jump to Present')).toBeInTheDocument();
    });

    it('does not show "Jump to Present" in normal mode', () => {
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          mode="normal"
        />,
      );

      expect(screen.queryByTestId('jump-to-present-fab')).not.toBeInTheDocument();
    });

    it('calls jumpToPresent when "Jump to Present" button is clicked', async () => {
      const jumpToPresent = vi.fn();
      const messages = [createMessage({ id: 'msg-1' })];

      const { user } = renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          mode="anchored"
          jumpToPresent={jumpToPresent}
        />,
      );

      await user.click(screen.getByTestId('jump-to-present-fab'));
      expect(jumpToPresent).toHaveBeenCalledTimes(1);
    });

    it('calls onLoadNewer when bottom sentinel intersects in anchored mode', () => {
      const onLoadNewer = vi.fn().mockResolvedValue(undefined);
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          mode="anchored"
          jumpToPresent={vi.fn()}
          onLoadNewer={onLoadNewer}
          isLoadingNewer={false}
          hasNewer={true}
        />,
      );

      // First threshold=0 observer is the bottom sentinel
      const bottomObserver = mockObserverInstances.find(
        (inst) => inst.options?.threshold === 0 && inst.elements.size > 0,
      );
      expect(bottomObserver).toBeDefined();

      act(() => {
        bottomObserver!.trigger([{ isIntersecting: true }]);
      });
      expect(onLoadNewer).toHaveBeenCalledTimes(1);
    });

    it('does not call onLoadNewer when isLoadingNewer is true', () => {
      const onLoadNewer = vi.fn().mockResolvedValue(undefined);
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          mode="anchored"
          jumpToPresent={vi.fn()}
          onLoadNewer={onLoadNewer}
          isLoadingNewer={true}
          hasNewer={true}
        />,
      );

      const bottomObserver = mockObserverInstances.find(
        (inst) => inst.options?.threshold === 0 && inst.elements.size > 0,
      );

      act(() => {
        bottomObserver!.trigger([{ isIntersecting: true }]);
      });
      expect(onLoadNewer).not.toHaveBeenCalled();
    });

    it('releases older pagination when anchored with no pending highlight', () => {
      // Regression: if the around-fetch outlives the 3s highlight flash,
      // highlightMessageId is already cleared when messages arrive. Initial
      // positioning must still complete and release the pagination
      // suppression — otherwise the anchored view strands with older
      // pagination permanently dead.
      const onLoadMore = vi.fn().mockResolvedValue(undefined);
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          mode="anchored"
          jumpToPresent={vi.fn()}
          continuationToken="older-token"
          onLoadMore={onLoadMore}
        />,
      );

      // threshold=0 observers: bottom sentinel (1st) and top sentinel (2nd)
      const thresholdZeroObservers = mockObserverInstances.filter(
        (inst) => inst.options?.threshold === 0,
      );
      expect(thresholdZeroObservers.length).toBeGreaterThanOrEqual(2);

      act(() => {
        thresholdZeroObservers[1].trigger([{ isIntersecting: true }]);
      });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('shows loading skeletons when isLoadingNewer is true', () => {
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          mode="anchored"
          jumpToPresent={vi.fn()}
          isLoadingNewer={true}
        />,
      );

      // 3 skeletons for newer loading
      const skeletons = screen.getAllByTestId('message-skeleton');
      expect(skeletons.length).toBe(3);
    });
  });

  // ── Context type ───────────────────────────────────────────────────
  describe('context type', () => {
    it('passes "dm" context type when directMessageGroupId is set', () => {
      const messages = [createMessage({ id: 'msg-1' })];

      renderWithProviders(
        <MessageContainer
          {...defaultProps}
          messages={messages}
          directMessageGroupId="dm-group-1"
        />,
      );

      expect(screen.getByTestId('message-msg-1')).toHaveAttribute(
        'data-context-type',
        'dm',
      );
    });
  });
});
