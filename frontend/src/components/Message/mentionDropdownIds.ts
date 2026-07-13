/**
 * DOM ids shared between MentionDropdown (the `role="listbox"`/`role="option"`
 * markup) and MessageInput (the `role="combobox"` input's `aria-controls`/
 * `aria-activedescendant`) — kept in their own module, rather than exported
 * from MentionDropdown.tsx alongside the component, so the component file
 * stays a fast-refresh-friendly single-export module.
 */

/** Stable id for the listbox — referenced by the input's `aria-controls`. */
export const MENTION_LISTBOX_ID = 'mention-suggestions-listbox';

/** Stable id for a given suggestion row — referenced by `aria-activedescendant`. */
export function mentionOptionId(index: number): string {
  return `mention-suggestion-option-${index}`;
}
