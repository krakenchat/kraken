import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import MessageComponent from '../../components/Message/MessageComponent';
import { createMessage } from '../test-utils/factories';
import { SpanType } from '../../types/message.type';

vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'user-1', username: 'alice' } }),
}));

vi.mock('../../contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ openProfile: vi.fn() }),
}));

vi.mock('../../components/Common/UserAvatar', () => ({
  default: () => <div data-testid="user-avatar" />,
}));

// Real (own-message) permissions — proves the pending/failed gating inside
// MessageComponent is what suppresses the toolbar, not the permission hook.
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

const mockRetry = vi.fn();
const mockRemove = vi.fn();
vi.mock('../../hooks/useOptimisticSendMessage', () => ({
  useOptimisticMessageRetry: () => ({ retry: mockRetry, remove: mockRemove }),
}));

describe('MessageComponent optimistic states (PR-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a pending message with a clock indicator and no action toolbar', () => {
    const message = createMessage({
      id: 'pending-1',
      clientId: 'pending-1',
      sendStatus: 'pending',
      authorId: 'user-1',
      spans: [{ type: SpanType.PLAINTEXT, text: 'sending soon' }],
    });

    renderWithProviders(<MessageComponent message={message} isAuthor onQuoteReply={vi.fn()} onOpenThread={vi.fn()} />);

    expect(screen.getByText('sending soon')).toBeInTheDocument();
    expect(screen.getByTestId('message-pending-icon')).toBeInTheDocument();
    // Real API-backed actions must be unreachable for an unpersisted message.
    expect(screen.queryByLabelText('Edit message')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete message')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Quote reply')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reply in thread')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to send')).not.toBeInTheDocument();
  });

  it('renders a failed message with always-visible, keyboard-reachable Retry/Delete actions', async () => {
    const message = createMessage({
      id: 'pending-2',
      clientId: 'pending-2',
      sendStatus: 'failed',
      authorId: 'user-1',
      spans: [{ type: SpanType.PLAINTEXT, text: 'oops' }],
    });

    const { user } = renderWithProviders(<MessageComponent message={message} isAuthor />);

    expect(screen.getByText('Failed to send')).toBeInTheDocument();
    // No pending clock on a failed row.
    expect(screen.queryByTestId('message-pending-icon')).not.toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Retry sending message' });
    const deleteButton = screen.getByRole('button', { name: 'Delete message' });

    // Real <button> elements rendered unconditionally (not opacity-gated
    // behind hover like MessageToolbar) — always in the tab order.
    expect(retryButton).toBeVisible();
    expect(deleteButton).toBeVisible();
    expect(retryButton.tabIndex).not.toBe(-1);
    expect(deleteButton.tabIndex).not.toBe(-1);

    await user.click(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(1);

    await user.click(deleteButton);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('renders a settled (real) message with no pending/failed chrome', () => {
    const message = createMessage({
      authorId: 'user-1',
      spans: [{ type: SpanType.PLAINTEXT, text: 'a normal message' }],
    });

    renderWithProviders(<MessageComponent message={message} isAuthor />);

    expect(screen.getByText('a normal message')).toBeInTheDocument();
    expect(screen.queryByTestId('message-pending-icon')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to send')).not.toBeInTheDocument();
  });
});
