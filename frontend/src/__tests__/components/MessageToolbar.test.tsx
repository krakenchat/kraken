import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { MessageToolbar, type MessageToolbarProps } from '../../components/Message/MessageToolbar';

vi.mock('../../components/Message/EmojiPicker', () => ({
  EmojiPicker: ({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) => (
    <button data-testid="emoji-picker" onClick={() => onEmojiSelect('👍')}>
      emoji
    </button>
  ),
}));

function defaultProps(overrides: Partial<MessageToolbarProps> = {}): MessageToolbarProps {
  return {
    canEdit: false,
    canDelete: false,
    canPin: false,
    canThread: false,
    isPinned: false,
    stagedForDelete: false,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onConfirmDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    onEmojiSelect: vi.fn(),
    onPin: vi.fn(),
    onUnpin: vi.fn(),
    onReplyInThread: vi.fn(),
    ...overrides,
  };
}

describe('MessageToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only emoji picker when all permissions are false', () => {
    const props = defaultProps();
    renderWithProviders(<MessageToolbar {...props} />);

    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
    // No other buttons besides the emoji picker
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
  });

  it('renders edit button when canEdit is true', async () => {
    const onEdit = vi.fn();
    const props = defaultProps({ canEdit: true, onEdit });
    const { user } = renderWithProviders(<MessageToolbar {...props} />);

    // Emoji picker + edit button = 2 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    // The edit button is the second button (after emoji picker)
    await user.click(buttons[1]);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('renders delete button when canDelete is true', async () => {
    const onDelete = vi.fn();
    const props = defaultProps({ canDelete: true, onDelete });
    const { user } = renderWithProviders(<MessageToolbar {...props} />);

    // Emoji picker + delete button = 2 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    // The delete button is the second button (after emoji picker)
    await user.click(buttons[1]);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('renders thread button when canThread is true and calls onReplyInThread', async () => {
    const onReplyInThread = vi.fn();
    const props = defaultProps({ canThread: true, onReplyInThread });
    const { user } = renderWithProviders(<MessageToolbar {...props} />);

    // Emoji picker + thread button = 2 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    // Thread button is after emoji picker
    await user.click(buttons[1]);
    expect(onReplyInThread).toHaveBeenCalledOnce();
  });

  it('renders pin button when canPin is true and isPinned is false, calls onPin', async () => {
    const onPin = vi.fn();
    const props = defaultProps({ canPin: true, isPinned: false, onPin });
    const { user } = renderWithProviders(<MessageToolbar {...props} />);

    // Emoji picker + pin button = 2 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    // Pin button is after emoji picker
    await user.click(buttons[1]);
    expect(onPin).toHaveBeenCalledOnce();
  });

  it('renders unpin button when canPin is true and isPinned is true, calls onUnpin', async () => {
    const onUnpin = vi.fn();
    const props = defaultProps({ canPin: true, isPinned: true, onUnpin });
    const { user } = renderWithProviders(<MessageToolbar {...props} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    await user.click(buttons[1]);
    expect(onUnpin).toHaveBeenCalledOnce();
  });

  it('renders all action buttons when all permissions are true', () => {
    const props = defaultProps({
      canEdit: true,
      canDelete: true,
      canPin: true,
      canThread: true,
    });
    renderWithProviders(<MessageToolbar {...props} />);

    // Emoji picker + thread + pin + edit + delete = 5 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('shows "Delete?" text when stagedForDelete is true', () => {
    const props = defaultProps({ stagedForDelete: true, canDelete: true });
    renderWithProviders(<MessageToolbar {...props} />);

    expect(screen.getByText('Delete?')).toBeInTheDocument();
  });

  it('calls onConfirmDelete when confirm button is clicked in staged state', async () => {
    const onConfirmDelete = vi.fn();
    const props = defaultProps({ stagedForDelete: true, onConfirmDelete });
    const { user } = renderWithProviders(<MessageToolbar {...props} />);

    // In staged state: confirm button + cancel button = 2 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    // Confirm button is the first button
    await user.click(buttons[0]);
    expect(onConfirmDelete).toHaveBeenCalledOnce();
  });

  it('calls onCancelDelete when cancel button is clicked in staged state', async () => {
    const onCancelDelete = vi.fn();
    const props = defaultProps({ stagedForDelete: true, onCancelDelete });
    const { user } = renderWithProviders(<MessageToolbar {...props} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    // Cancel button is the second button
    await user.click(buttons[1]);
    expect(onCancelDelete).toHaveBeenCalledOnce();
  });
});
