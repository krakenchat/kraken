import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import MessageInput from '../../components/Message/MessageInput';
import { VoiceSessionType } from '../../contexts/VoiceContext';

/**
 * Focused regression test for the composer's emoji-picker Escape/focus-
 * restoration fix (see MessageInput.tsx `handleEmojiPickerClose`).
 *
 * The main MessageInput.test.tsx suite mocks EmojiPickerPopover entirely (to
 * make emoji *selection* deterministic), so it never exercises the real
 * Popover's `disableRestoreFocus` + manual restore-on-close path. This file
 * renders the real EmojiPickerPopover to verify that path specifically.
 */

// Let MSW intercept API-client requests
vi.mock('../../api-client/client.gen', async (importOriginal) => {
  const { createClient, createConfig } = await import('../../api-client/client');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    client: createClient(createConfig({ baseUrl: 'http://localhost:3000' })),
  };
});

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
    <MessageInput
      contextType={VoiceSessionType.Dm}
      contextId="dm-1"
      userMentions={[]}
      onSendMessage={vi.fn()}
    />,
  );
  const input = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement;
  return { ...utils, input };
}

describe('MessageInput emoji picker focus restoration', () => {
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

    // Pick the first "thumbs up" (it recurs across categories by design —
    // see EmojiPickerPopover.test.tsx — so take the first, in "Frequently
    // Used").
    await user.click(screen.getAllByLabelText('thumbs up')[0]);

    await waitFor(() => {
      expect(input.value).toContain('👍');
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });
});
