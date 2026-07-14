import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { ThreadMessageInput } from '../../components/Thread/ThreadMessageInput';

/**
 * Focused regression test for the thread composer's emoji-picker
 * Escape/focus-restoration fix (see ThreadMessageInput.tsx
 * `handleEmojiPickerClose`), mirroring
 * MessageInput.emojiFocusRestore.test.tsx.
 *
 * ThreadMessageInput uses the same EmojiPickerPopover `anchorEl` +
 * `disableRestoreFocus` path as MessageInput, so it needs the same
 * reason-aware close handler to restore focus to the invoking button on
 * Escape/backdrop-close (rather than dropping focus to <body>).
 */

const mockResponsive = vi.fn(() => ({
  isTouchDevice: false,
  shouldUseTouchUI: false,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  deviceType: 'desktop' as string,
}));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive(),
}));

function setup() {
  const utils = renderWithProviders(
    <ThreadMessageInput parentMessageId="msg-1" />,
  );
  const input = screen.getByPlaceholderText('Reply...') as HTMLTextAreaElement;
  return { ...utils, input };
}

describe('ThreadMessageInput emoji picker focus restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponsive.mockReturnValue({
      isTouchDevice: false,
      shouldUseTouchUI: false,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      deviceType: 'desktop',
    });
  });

  it('Escape closes the emoji popover and restores focus to the emoji button (Popover disables its own auto-restore here)', async () => {
    const { user } = setup();

    const emojiButton = screen.getByLabelText('add emoji');
    await user.click(emojiButton);

    await screen.findByPlaceholderText('Search emojis...');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search emojis...')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(emojiButton);
    });
  });

  it('selecting an emoji still returns focus to the composer input, not the emoji button', async () => {
    const { user, input } = setup();

    await user.click(screen.getByLabelText('add emoji'));
    await screen.findByPlaceholderText('Search emojis...');

    // "thumbs up" recurs across categories by design (e.g. "Frequently
    // Used" and "Smileys & People") — see EmojiPickerPopover.test.tsx.
    await user.click(screen.getAllByLabelText('thumbs up')[0]);

    await waitFor(() => {
      expect(input.value).toContain('👍');
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });
});
