import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import MessageActionsSheet, {
  type MessageActionsSheetProps,
} from '../../components/Message/MessageActionsSheet';
import { createMessage } from '../test-utils/factories';
import { SpanType } from '../../types/message.type';

vi.mock('../../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

function defaultProps(
  overrides: Partial<MessageActionsSheetProps> = {},
): MessageActionsSheetProps {
  return {
    anchorPosition: null,
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
    onEmojiSelect: vi.fn(),
    ...overrides,
  };
}

describe('MessageActionsSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all action rows for an owner with full permissions', () => {
    const props = defaultProps({
      canEdit: true,
      canDelete: true,
      canPin: true,
      canReact: true,
      canThread: true,
      onQuoteReply: vi.fn(),
    });
    renderWithProviders(<MessageActionsSheet {...props} />);

    expect(screen.getByText('Reply')).toBeInTheDocument();
    expect(screen.getByText('Reply in Thread')).toBeInTheDocument();
    expect(screen.getByText('Pin Message')).toBeInTheDocument();
    expect(screen.getByText('Edit Message')).toBeInTheDocument();
    expect(screen.getByText('Delete Message')).toBeInTheDocument();
    expect(screen.getByText('Copy Message Content')).toBeInTheDocument();
    // Reaction is served by the quick-reaction row, not a list row
    expect(screen.queryByText('Add Reaction')).not.toBeInTheDocument();
  });

  it('shows the quick-reaction row (and + button) only when canReact', () => {
    const { rerender } = renderWithProviders(
      <MessageActionsSheet {...defaultProps({ canReact: true })} />,
    );
    expect(screen.getByLabelText('React with 👍')).toBeInTheDocument();
    expect(screen.getByLabelText('More reactions')).toBeInTheDocument();

    rerender(<MessageActionsSheet {...defaultProps({ canReact: false })} />);
    expect(screen.queryByLabelText('React with 👍')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('More reactions')).not.toBeInTheDocument();
  });

  it('hides Edit/Delete/Pin for a non-owner without permissions', () => {
    renderWithProviders(<MessageActionsSheet {...defaultProps()} />);

    expect(screen.queryByText('Edit Message')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Message')).not.toBeInTheDocument();
    expect(screen.queryByText('Pin Message')).not.toBeInTheDocument();
    // Copy is always available
    expect(screen.getByText('Copy Message Content')).toBeInTheDocument();
  });

  it('shows "Unpin Message" when the message is pinned', () => {
    renderWithProviders(
      <MessageActionsSheet {...defaultProps({ canPin: true, isPinned: true })} />,
    );
    expect(screen.getByText('Unpin Message')).toBeInTheDocument();
    expect(screen.queryByText('Pin Message')).not.toBeInTheDocument();
  });

  it('invokes the delete handler and closes on tap', async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <MessageActionsSheet
        {...defaultProps({ canDelete: true, onDelete, onClose })}
      />,
    );

    await user.click(screen.getByText('Delete Message'));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('adds a quick reaction and closes the sheet', async () => {
    const onEmojiSelect = vi.fn();
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <MessageActionsSheet
        {...defaultProps({ canReact: true, onEmojiSelect, onClose })}
      />,
    );

    await user.click(screen.getByLabelText('React with ❤️'));
    expect(onEmojiSelect).toHaveBeenCalledWith('❤️');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens the full picker via the + button', async () => {
    const onAddReaction = vi.fn();
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <MessageActionsSheet
        {...defaultProps({ canReact: true, onAddReaction, onClose })}
      />,
    );

    await user.click(screen.getByLabelText('More reactions'));
    expect(onAddReaction).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('copies message content on tap', async () => {
    const { copyToClipboard } = await import('../../utils/clipboard');
    vi.mocked(copyToClipboard).mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <MessageActionsSheet
        {...defaultProps({
          message: createMessage({
            spans: [{ type: SpanType.PLAINTEXT, text: 'Copy me' }],
          }),
          onClose,
        })}
      />,
    );

    await user.click(screen.getByText('Copy Message Content'));
    expect(copyToClipboard).toHaveBeenCalledWith('Copy me');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
