import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, cleanup } from '@testing-library/react';
import { renderWithProviders, runAxe, expectNoAxeViolations } from '../test-utils';
import VirtualMessageList from '../../components/Message/VirtualMessageList';
import { createMessage, resetFactoryCounter } from '../test-utils/factories';
import { SpanType } from '../../types/message.type';

/**
 * Roving row-focus keyboard navigation + list semantics.
 *
 * Unlike VirtualMessageList.test.tsx (which mocks MessageComponent to a
 * plain stub, keeping the unit boundary at "does VirtualMessageList wire
 * virtua correctly"), this file renders the REAL MessageComponent so the
 * full roving-focus path — Container's tabIndex/onKeyDown/onFocus wiring,
 * guarded against bubbled events from descendant controls, and the
 * Enter/ContextMenu-opens-menu integration — is exercised end-to-end.
 * `virtua` is still mocked (jsdom can't do real layout/virtualization),
 * rendering every row unconditionally — which also means the rAF-retry loop
 * in moveFocus succeeds on its first attempt here (the target row is always
 * already present), consistent with how VirtualMessageList.test.tsx already
 * runs requestAnimationFrame synchronously.
 */

vi.mock('../../utils/platform', () => ({
  isElectron: vi.fn(() => false),
  isWeb: vi.fn(() => true),
}));
vi.mock('../../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'current-user', username: 'alice' } }),
}));
vi.mock('../../contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ openProfile: vi.fn() }),
}));
vi.mock('../../components/Common/UserAvatar', () => ({
  default: () => <div data-testid="avatar" />,
}));

const mockPermissions = {
  canEdit: true,
  canDelete: true,
  canPin: true,
  canReact: true,
  isOwnMessage: true,
};
vi.mock('../../hooks/useMessagePermissions', () => ({
  useMessagePermissions: () => mockPermissions,
}));

const mockActions = {
  isEditing: false,
  editText: '',
  editAttachments: [],
  stagedForDelete: false,
  isDeleting: false,
  setEditText: vi.fn(),
  handleEditClick: vi.fn(),
  handleEditSave: vi.fn(),
  handleEditCancel: vi.fn(),
  handleRemoveAttachment: vi.fn(),
  handleDeleteClick: vi.fn(),
  handleConfirmDelete: vi.fn(),
  handleCancelDelete: vi.fn(),
  handleConfirmThreadDelete: vi.fn(),
  handleCancelThreadDelete: vi.fn(),
  showThreadDeleteConfirm: false,
  handleReactionClick: vi.fn(),
  handleEmojiSelect: vi.fn(),
  handlePin: vi.fn(),
  handleUnpin: vi.fn(),
};
vi.mock('../../components/Message/useMessageActions', () => ({
  useMessageActions: () => mockActions,
}));

vi.mock('virtua', async () => {
  const ReactMod = await import('react');
  return {
    VList: ReactMod.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactMod.useImperativeHandle(
          ref,
          () => ({
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
          }),
          [],
        );
        return (
          <div
            data-testid="vlist"
            role={props.role as string | undefined}
            aria-label={props['aria-label'] as string | undefined}
          >
            {props.children as React.ReactNode}
          </div>
        );
      },
    ),
  };
});

function msg(id: string, text: string) {
  return createMessage({ id, spans: [{ type: SpanType.PLAINTEXT, text }] });
}

function rowFor(text: string): HTMLElement {
  const node = screen.getByText(text);
  const row = node.closest('[data-row-focus-target]');
  if (!row) throw new Error(`row focus target not found for "${text}"`);
  return row as HTMLElement;
}

const baseProps = {
  authorId: 'current-user',
  isLoadingMore: false,
  unreadCount: 0,
  lastReadIndex: -1,
};

beforeEach(() => {
  resetFactoryCounter();
  // rAF runs synchronously — the mocked VList renders every row
  // unconditionally, so moveFocus's retry loop always finds its target on
  // the first attempt.
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

describe('VirtualMessageList roving row focus', () => {
  it('lands the initial roving-tabindex target on the newest row', () => {
    renderWithProviders(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[msg('m1', 'one'), msg('m2', 'two'), msg('m3', 'three')]}
      />,
    );
    expect(rowFor('three')).toHaveAttribute('tabindex', '0');
    expect(rowFor('one')).toHaveAttribute('tabindex', '-1');
    expect(rowFor('two')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowUp moves the roving target and DOM focus to the previous row', () => {
    renderWithProviders(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[msg('m1', 'one'), msg('m2', 'two'), msg('m3', 'three')]}
      />,
    );
    fireEvent.keyDown(rowFor('three'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rowFor('two'));
    expect(rowFor('two')).toHaveAttribute('tabindex', '0');
    expect(rowFor('three')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowDown moves focus forward', () => {
    renderWithProviders(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[msg('m1', 'one'), msg('m2', 'two'), msg('m3', 'three')]}
      />,
    );
    fireEvent.keyDown(rowFor('three'), { key: 'ArrowUp' }); // now on 'two'
    fireEvent.keyDown(rowFor('two'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowFor('three'));
  });

  it('clamps at the top and bottom edges (no-op past the first/last row)', () => {
    renderWithProviders(
      <VirtualMessageList {...baseProps} orderedMessages={[msg('m1', 'one'), msg('m2', 'two')]} />,
    );
    fireEvent.keyDown(rowFor('two'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowFor('two'));

    fireEvent.keyDown(rowFor('two'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rowFor('one'));
    fireEvent.keyDown(rowFor('one'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rowFor('one'));
  });

  it('Home moves focus to the oldest-loaded row, End to the newest', () => {
    renderWithProviders(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[msg('m1', 'one'), msg('m2', 'two'), msg('m3', 'three')]}
      />,
    );
    fireEvent.keyDown(rowFor('three'), { key: 'Home' });
    expect(document.activeElement).toBe(rowFor('one'));
    fireEvent.keyDown(rowFor('one'), { key: 'End' });
    expect(document.activeElement).toBe(rowFor('three'));
  });

  it('keeps the roving target on the same message across a re-render (new message appended)', () => {
    const { rerender } = renderWithProviders(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[msg('m1', 'one'), msg('m2', 'two'), msg('m3', 'three')]}
      />,
    );
    fireEvent.keyDown(rowFor('three'), { key: 'ArrowUp' }); // -> 'two'
    expect(rowFor('two')).toHaveAttribute('tabindex', '0');

    rerender(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[
          msg('m1', 'one'),
          msg('m2', 'two'),
          msg('m3', 'three'),
          msg('m4', 'four'),
        ]}
      />,
    );
    // Still 'two' — not reset to the new newest row just because a message arrived.
    expect(rowFor('two')).toHaveAttribute('tabindex', '0');
    expect(rowFor('four')).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(rowFor('two'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowFor('three'));
  });

  it('Escape (no menu open) calls onEscapeToInput', () => {
    const onEscapeToInput = vi.fn();
    renderWithProviders(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[msg('m1', 'one')]}
        onEscapeToInput={onEscapeToInput}
      />,
    );
    fireEvent.keyDown(rowFor('one'), { key: 'Escape' });
    expect(onEscapeToInput).toHaveBeenCalledTimes(1);
  });

  it('Enter opens the row context menu', async () => {
    renderWithProviders(
      <VirtualMessageList {...baseProps} orderedMessages={[msg('m1', 'one')]} />,
    );
    fireEvent.keyDown(rowFor('one'), { key: 'Enter' });
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Edit Message')).toBeInTheDocument();
  });

  it('ContextMenu key also opens the row context menu', async () => {
    renderWithProviders(
      <VirtualMessageList {...baseProps} orderedMessages={[msg('m1', 'one')]} />,
    );
    fireEvent.keyDown(rowFor('one'), { key: 'ContextMenu' });
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('does not hijack keys bubbling from a descendant control (only the row itself is a valid target)', () => {
    const onEscapeToInput = vi.fn();
    renderWithProviders(
      <VirtualMessageList
        {...baseProps}
        orderedMessages={[msg('m1', 'one')]}
        onEscapeToInput={onEscapeToInput}
      />,
    );
    const textNode = screen.getByText('one');
    fireEvent.keyDown(textNode, { key: 'Escape' });
    expect(onEscapeToInput).not.toHaveBeenCalled();
  });

  describe('list semantics', () => {
    it('uses role="list" with an accessible name, and role="listitem" per row', () => {
      renderWithProviders(
        <VirtualMessageList {...baseProps} orderedMessages={[msg('m1', 'one'), msg('m2', 'two')]} />,
      );
      expect(screen.getByRole('list', { name: 'Messages' })).toBeInTheDocument();
      expect(screen.getAllByRole('listitem').length).toBe(2);
    });

    it('has no axe violations across a small rendered list', async () => {
      renderWithProviders(
        <VirtualMessageList
          {...baseProps}
          orderedMessages={[msg('m1', 'one'), msg('m2', 'two'), msg('m3', 'three')]}
        />,
      );
      // Bounded to WCAG A/AA tags — see EmojiPickerPopover.test.tsx for why
      // (axe's full default rule set is too slow per-node under coverage).
      const results = await runAxe(document.body, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      });
      expectNoAxeViolations(results);
    }, 60000);
  });
});
