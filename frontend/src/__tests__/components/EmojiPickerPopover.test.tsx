import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import {
  EmojiPickerPopover,
  type EmojiPickerPopoverProps,
} from '../../components/Message/EmojiPicker';

function defaultProps(
  overrides: Partial<EmojiPickerPopoverProps> = {},
): EmojiPickerPopoverProps {
  return {
    open: true,
    anchorPosition: { top: 100, left: 200 },
    onClose: vi.fn(),
    onEmojiSelect: vi.fn(),
    ...overrides,
  };
}

describe('EmojiPickerPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders emoji grid when open is true', () => {
    const props = defaultProps();
    renderWithProviders(<EmojiPickerPopover {...props} />);

    // Should show the search field
    expect(
      screen.getByPlaceholderText('Search emojis...'),
    ).toBeInTheDocument();
    // Should show at least the first category header
    expect(screen.getByText('Frequently Used')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    const props = defaultProps({ open: false, anchorPosition: null });
    renderWithProviders(<EmojiPickerPopover {...props} />);

    expect(
      screen.queryByPlaceholderText('Search emojis...'),
    ).not.toBeInTheDocument();
  });

  it('calls onEmojiSelect and onClose when an emoji is clicked', async () => {
    const onEmojiSelect = vi.fn();
    const onClose = vi.fn();
    const props = defaultProps({ onEmojiSelect, onClose });
    const { user } = renderWithProviders(
      <EmojiPickerPopover {...props} />,
    );

    // Find and click one of the emoji buttons — the first one in
    // "Frequently Used" category is the thumbs up emoji
    const emojiButtons = screen.getAllByRole('button');
    // The first buttons include the clear icon in search; find
    // an emoji button by its content
    const thumbsUpButton = emojiButtons.find(
      (btn) => btn.textContent === '\uD83D\uDC4D',
    );
    expect(thumbsUpButton).toBeDefined();

    await user.click(thumbsUpButton!);
    expect(onEmojiSelect).toHaveBeenCalledWith('\uD83D\uDC4D');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
