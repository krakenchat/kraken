import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, act } from '@testing-library/react';
import { renderWithProviders, runAxe, expectNoAxeViolations } from '../test-utils';
import {
  EmojiPickerPopover,
  type EmojiPickerPopoverProps,
} from '../../components/Message/EmojiPicker';

// Focusing an element directly (vs. via userEvent) fires React's onFocus
// synchronously outside of React's event batching, which triggers an "not
// wrapped in act(...)" warning even though the assertions are still valid.
// Wrap it so tests exercise the same roving-tabindex onFocus sync the app
// relies on (e.g. tabbing in from the search field) without the noise.
function focus(element: HTMLElement) {
  act(() => {
    element.focus();
  });
}

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

  describe('roving-tabindex grid navigation', () => {
    // "Frequently Used" (the first, default-visible category) is:
    // 👍 👎 ❤️ 😂 😮 😢 😡 👏 | 🎉 🔥 💯 ⭐ ✅ ❌ 🤔 😍  (8 columns × 2 rows)
    //
    // Several of these emoji (👍, 👎, 👏, 😂, 😮, 😢, 😡, 🎉…) also appear in
    // OTHER categories further down the picker by design (recurring
    // "reaction" emoji), so their aria-labels aren't page-unique — queries
    // below are scoped with `within(...)` to the category's own group to
    // disambiguate, rather than relying on global label lookups.
    function frequentlyUsedGroup() {
      return within(screen.getByRole('group', { name: 'Frequently Used' }));
    }

    it('only the active cell is in the tab order, defaulting to the first emoji', () => {
      renderWithProviders(<EmojiPickerPopover {...defaultProps()} />);

      const group = frequentlyUsedGroup();
      expect(group.getByLabelText('thumbs up')).toHaveAttribute('tabindex', '0');
      expect(group.getByLabelText('thumbs down')).toHaveAttribute('tabindex', '-1');
    });

    it('ArrowRight moves focus to the next cell and updates the roving tabindex', async () => {
      const { user } = renderWithProviders(<EmojiPickerPopover {...defaultProps()} />);
      const group = frequentlyUsedGroup();

      const first = group.getByLabelText('thumbs up');
      focus(first);
      expect(first).toHaveFocus();

      await user.keyboard('{ArrowRight}');

      const second = group.getByLabelText('thumbs down');
      expect(second).toHaveFocus();
      expect(second).toHaveAttribute('tabindex', '0');
      expect(first).toHaveAttribute('tabindex', '-1');
    });

    it('ArrowLeft at the first cell of a row does nothing (no previous section)', async () => {
      const { user } = renderWithProviders(<EmojiPickerPopover {...defaultProps()} />);
      const group = frequentlyUsedGroup();

      const first = group.getByLabelText('thumbs up');
      focus(first);
      await user.keyboard('{ArrowLeft}');

      expect(first).toHaveFocus();
    });

    it('ArrowDown moves focus one row down (8 cells) within the category', async () => {
      const { user } = renderWithProviders(<EmojiPickerPopover {...defaultProps()} />);
      const group = frequentlyUsedGroup();

      focus(group.getByLabelText('thumbs up'));
      await user.keyboard('{ArrowDown}');

      // Index 0 + 8 columns = index 8 = 🎉 ("party")
      expect(group.getByLabelText('party')).toHaveFocus();
    });

    it('End moves to the last cell of the current row, Home moves back to the first', async () => {
      const { user } = renderWithProviders(<EmojiPickerPopover {...defaultProps()} />);
      const group = frequentlyUsedGroup();

      focus(group.getByLabelText('thumbs down'));
      await user.keyboard('{End}');
      // Row 0 is indices 0-7; index 7 = 👏 ("clap")
      expect(group.getByLabelText('clap')).toHaveFocus();

      await user.keyboard('{Home}');
      expect(group.getByLabelText('thumbs up')).toHaveFocus();
    });

    it('PageDown jumps to the first cell of the next category', async () => {
      const { user } = renderWithProviders(<EmojiPickerPopover {...defaultProps()} />);

      focus(frequentlyUsedGroup().getByLabelText('thumbs up'));
      await user.keyboard('{PageDown}');

      // First cell of "Smileys & People" (the next category) is 😀 ("grin")
      const nextGroup = within(screen.getByRole('group', { name: 'Smileys & People' }));
      expect(nextGroup.getByLabelText('grin')).toHaveFocus();
    });

    it('Enter selects the focused emoji and closes the popover', async () => {
      const onEmojiSelect = vi.fn();
      const onClose = vi.fn();
      const { user } = renderWithProviders(
        <EmojiPickerPopover {...defaultProps({ onEmojiSelect, onClose })} />,
      );

      focus(frequentlyUsedGroup().getByLabelText('thumbs up'));
      await user.keyboard('{Enter}');

      expect(onEmojiSelect).toHaveBeenCalledWith('👍');
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('Escape closes the popover', async () => {
      const onClose = vi.fn();
      const { user } = renderWithProviders(
        <EmojiPickerPopover {...defaultProps({ onClose })} />,
      );

      focus(frequentlyUsedGroup().getByLabelText('thumbs up'));
      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    // axe's scan of the full emoji grid is legitimately slow (3s+ observed
    // locally, more on a loaded CI runner) — give this one test more room
    // than the file's default budget instead of letting it ride the shared
    // 15s testTimeout.
    it('has no axe violations while open', async () => {
      // MUI's Grow transition (Popover's default `timeout="auto"`) settles
      // its "entered" state via one or more internal timers (an
      // auto-computed height-based duration, Popper repositioning, etc).
      // None of these correspond to a real animation in jsdom (there's no
      // layout engine), so there's nothing to wait for in real time — a
      // previous fix drained them with a fixed real 300ms sleep inside
      // act(), which is timing-coupled to nothing in particular and
      // flaked/timed out on slow CI runners. Fake timers let us flush all
      // of them deterministically in virtual time (no real wall-clock
      // delay) before axe scans the DOM, with no risk of an "update not
      // wrapped in act(...)" warning landing outside the flush.
      vi.useFakeTimers();
      try {
        renderWithProviders(<EmojiPickerPopover {...defaultProps()} />);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      } finally {
        vi.useRealTimers();
      }

      await screen.findByPlaceholderText('Search emojis...');

      // MUI's Popover portals into document.body (outside RTL's render
      // `container`), so scan the whole document to actually include it.
      const results = await runAxe(document.body);
      expectNoAxeViolations(results);
    }, 20000);
  });
});
