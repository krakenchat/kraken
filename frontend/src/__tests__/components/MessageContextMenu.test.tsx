import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import MessageContextMenu, {
  type MessageContextMenuProps,
} from '../../components/Message/MessageContextMenu';
import { createMessage } from '../test-utils/factories';
import { SpanType } from '../../types/message.type';

// Mock clipboard utility
vi.mock('../../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

function defaultProps(
  overrides: Partial<MessageContextMenuProps> = {},
): MessageContextMenuProps {
  return {
    anchorPosition: { top: 100, left: 200 },
    open: true,
    onClose: vi.fn(),
    message: createMessage({
      spans: [{ type: SpanType.PLAINTEXT, text: 'Hello world' }],
    }),
    canEdit: false,
    canDelete: false,
    canPin: false,
    canReact: false,
    canThread: false,
    isPinned: false,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onPin: vi.fn(),
    onUnpin: vi.fn(),
    onReplyInThread: vi.fn(),
    onAddReaction: vi.fn(),
    ...overrides,
  };
}

describe('MessageContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all menu items when user has all permissions', () => {
    const props = defaultProps({
      canEdit: true,
      canDelete: true,
      canPin: true,
      canReact: true,
      canThread: true,
      onQuoteReply: vi.fn(),
    });
    renderWithProviders(<MessageContextMenu {...props} />);

    expect(screen.getByText('Reply')).toBeInTheDocument();
    expect(screen.getByText('Reply in Thread')).toBeInTheDocument();
    expect(screen.getByText('Add Reaction')).toBeInTheDocument();
    expect(screen.getByText('Pin Message')).toBeInTheDocument();
    expect(screen.getByText('Edit Message')).toBeInTheDocument();
    expect(screen.getByText('Delete Message')).toBeInTheDocument();
    expect(screen.getByText('Copy Message Content')).toBeInTheDocument();
  });

  it('does not render Edit/Delete when canEdit and canDelete are false', () => {
    const props = defaultProps({
      canEdit: false,
      canDelete: false,
    });
    renderWithProviders(<MessageContextMenu {...props} />);

    expect(screen.queryByText('Edit Message')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Message')).not.toBeInTheDocument();
    // Copy should always be present
    expect(screen.getByText('Copy Message Content')).toBeInTheDocument();
  });

  it('does not render Pin when canPin is false', () => {
    const props = defaultProps({ canPin: false });
    renderWithProviders(<MessageContextMenu {...props} />);

    expect(screen.queryByText('Pin Message')).not.toBeInTheDocument();
    expect(screen.queryByText('Unpin Message')).not.toBeInTheDocument();
  });

  it('shows "Unpin Message" when isPinned is true', () => {
    const props = defaultProps({ canPin: true, isPinned: true });
    renderWithProviders(<MessageContextMenu {...props} />);

    expect(screen.getByText('Unpin Message')).toBeInTheDocument();
    expect(screen.queryByText('Pin Message')).not.toBeInTheDocument();
  });

  it('does not render Reply in Thread when canThread is false', () => {
    const props = defaultProps({ canThread: false });
    renderWithProviders(<MessageContextMenu {...props} />);

    expect(
      screen.queryByText('Reply in Thread'),
    ).not.toBeInTheDocument();
  });

  it('does not render Reply when onQuoteReply is not provided', () => {
    const props = defaultProps({ onQuoteReply: undefined });
    renderWithProviders(<MessageContextMenu {...props} />);

    expect(screen.queryByText('Reply')).not.toBeInTheDocument();
  });

  it('does not render Add Reaction when canReact is false', () => {
    const props = defaultProps({ canReact: false });
    renderWithProviders(<MessageContextMenu {...props} />);

    expect(screen.queryByText('Add Reaction')).not.toBeInTheDocument();
  });

  it('calls onQuoteReply and onClose when Reply is clicked', async () => {
    const onQuoteReply = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({ onQuoteReply, onClose });
    const { user } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    await user.click(screen.getByText('Reply'));
    expect(onQuoteReply).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onReplyInThread and onClose when Reply in Thread is clicked', async () => {
    const onReplyInThread = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({ canThread: true, onReplyInThread, onClose });
    const { user } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    await user.click(screen.getByText('Reply in Thread'));
    expect(onReplyInThread).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onAddReaction and onClose when Add Reaction is clicked', async () => {
    const onAddReaction = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({ canReact: true, onAddReaction, onClose });
    const { user } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    await user.click(screen.getByText('Add Reaction'));
    expect(onAddReaction).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onPin and onClose when Pin Message is clicked', async () => {
    const onPin = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({
      canPin: true,
      isPinned: false,
      onPin,
      onClose,
    });
    const { user } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    await user.click(screen.getByText('Pin Message'));
    expect(onPin).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onUnpin and onClose when Unpin Message is clicked', async () => {
    const onUnpin = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({
      canPin: true,
      isPinned: true,
      onUnpin,
      onClose,
    });
    const { user } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    await user.click(screen.getByText('Unpin Message'));
    expect(onUnpin).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onEdit and onClose when Edit Message is clicked', async () => {
    const onEdit = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({ canEdit: true, onEdit, onClose });
    const { user } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    await user.click(screen.getByText('Edit Message'));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onDelete and onClose when Delete Message is clicked', async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({ canDelete: true, onDelete, onClose });
    const { user } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    await user.click(screen.getByText('Delete Message'));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('copies message content using copyToClipboard', async () => {
    const { copyToClipboard } = await import('../../utils/clipboard');
    vi.mocked(copyToClipboard).mockResolvedValue(undefined);

    const onClose = vi.fn();
    const props = defaultProps({
      message: createMessage({
        spans: [{ type: SpanType.PLAINTEXT, text: 'Copy me' }],
      }),
      onClose,
    });
    const { user } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    await user.click(screen.getByText('Copy Message Content'));
    expect(copyToClipboard).toHaveBeenCalledWith('Copy me');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('copies multi-span message content correctly', async () => {
    const { copyToClipboard } = await import('../../utils/clipboard');
    vi.mocked(copyToClipboard).mockResolvedValue(undefined);

    const onClose = vi.fn();
    const props = defaultProps({
      message: createMessage({
        spans: [
          { type: SpanType.PLAINTEXT, text: 'Hello ' },
          { type: SpanType.USER_MENTION, text: '@alice', userId: 'u1' },
        ],
      }),
      onClose,
    });
    const { user } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    await user.click(screen.getByText('Copy Message Content'));
    expect(copyToClipboard).toHaveBeenCalledWith('Hello @alice');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render when open is false', () => {
    const props = defaultProps({ open: false, anchorPosition: null });
    const { container } = renderWithProviders(
      <MessageContextMenu {...props} />,
    );

    // Menu should not render visible items
    expect(screen.queryByText('Copy Message Content')).not.toBeInTheDocument();
    // The MUI Menu may still render a hidden container
    expect(container.querySelector('[role="menu"]')).not.toBeInTheDocument();
  });
});
