import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, runAxe, expectNoAxeViolations } from '../test-utils';
import MessageComponent from '../../components/Message/MessageComponent';
import { createMessage } from '../test-utils/factories';
import { SpanType } from '../../types/message.type';

// Mock platform detection — web, to prove the context menu works outside Electron
vi.mock('../../utils/platform', () => ({
  isElectron: vi.fn(() => false),
  isWeb: vi.fn(() => true),
}));

vi.mock('../../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'user-1', username: 'alice' } }),
}));

vi.mock('../../contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ openProfile: vi.fn() }),
}));

// UserAvatar requires FileCacheProvider; stub it out
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

function renderMessage() {
  const message = createMessage({
    spans: [{ type: SpanType.PLAINTEXT, text: 'Right-click me' }],
  });
  return {
    message,
    ...renderWithProviders(<MessageComponent message={message} />),
  };
}

describe('MessageComponent context menu (web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the custom context menu on right-click and prevents the native menu', () => {
    renderMessage();

    const messageText = screen.getByText('Right-click me');
    const notPrevented = fireEvent.contextMenu(messageText, {
      clientX: 120,
      clientY: 240,
    });

    // fireEvent returns false when preventDefault was called
    expect(notPrevented).toBe(false);
    expect(screen.getByText('Copy Message Content')).toBeInTheDocument();
    expect(screen.getByText('Edit Message')).toBeInTheDocument();
    expect(screen.getByText('Delete Message')).toBeInTheDocument();
  });

  it('closes the context menu on Escape', async () => {
    renderMessage();

    fireEvent.contextMenu(screen.getByText('Right-click me'));
    const menu = await screen.findByRole('menu');

    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByText('Copy Message Content')).not.toBeInTheDocument(),
    );
  });

  it('invokes the edit action from the context menu', async () => {
    const { user } = renderMessage();

    fireEvent.contextMenu(screen.getByText('Right-click me'));
    await user.click(screen.getByText('Edit Message'));

    expect(mockActions.handleEditClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('restores focus to the message row on Escape (anchorPosition menus have no anchorEl for MUI to auto-restore to)', async () => {
    renderMessage();

    const messageText = screen.getByText('Right-click me');
    // The message row is the nearest ancestor with tabIndex=-1 — added
    // specifically so it can receive focus programmatically after the
    // context menu (opened via right-click, not a focusable button) closes.
    const messageRow = messageText.closest('[tabindex="-1"]');
    expect(messageRow).not.toBeNull();

    fireEvent.contextMenu(messageText, { clientX: 10, clientY: 10 });
    const menu = await screen.findByRole('menu');

    fireEvent.keyDown(menu, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(messageRow);
    });
  });

  it('has no axe violations while the context menu is open', async () => {
    renderMessage();

    fireEvent.contextMenu(screen.getByText('Right-click me'), {
      clientX: 10,
      clientY: 10,
    });
    await screen.findByRole('menu');

    // MUI's Menu portals into document.body (outside RTL's `container`), so
    // scan the whole document to actually include the open menu.
    const results = await runAxe(document.body);
    expectNoAxeViolations(results);
  });
});
