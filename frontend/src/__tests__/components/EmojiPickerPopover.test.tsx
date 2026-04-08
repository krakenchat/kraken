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

});
