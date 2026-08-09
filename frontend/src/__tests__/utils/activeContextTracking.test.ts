import { isContextViewedAndFocused } from '../../utils/activeContextTracking';
import { setActiveDmGroupId } from '../../utils/activeDmTracking';

describe('activeContextTracking', () => {
  let hasFocusSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    hasFocusSpy = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  afterEach(() => {
    hasFocusSpy.mockRestore();
    window.history.pushState({}, '', '/');
    setActiveDmGroupId(null);
  });

  it('returns false when the tab is blurred, even if the channel route matches', () => {
    hasFocusSpy.mockReturnValue(false);
    window.history.pushState({}, '', '/community/c1/channel/ch-1');

    expect(isContextViewedAndFocused('ch-1', undefined)).toBe(false);
  });

  it('returns false when the tab is hidden, even if the channel route matches', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    window.history.pushState({}, '', '/community/c1/channel/ch-1');

    expect(isContextViewedAndFocused('ch-1', undefined)).toBe(false);
  });

  it('returns true when focused and the pathname matches the given channel', () => {
    window.history.pushState({}, '', '/community/c1/channel/ch-1');

    expect(isContextViewedAndFocused('ch-1', undefined)).toBe(true);
  });

  it('returns false when focused but viewing a different channel', () => {
    window.history.pushState({}, '', '/community/c1/channel/other');

    expect(isContextViewedAndFocused('ch-1', undefined)).toBe(false);
  });

  it('does not prefix-match a channel id against a longer id in the route', () => {
    window.history.pushState({}, '', '/community/c1/channel/ch-10');

    expect(isContextViewedAndFocused('ch-1', undefined)).toBe(false);
  });

  it('matches when the channel segment is followed by a sub-route', () => {
    window.history.pushState({}, '', '/community/c1/channel/ch-1/threads');

    expect(isContextViewedAndFocused('ch-1', undefined)).toBe(true);
  });

  it('returns true when focused and the active DM group matches', () => {
    setActiveDmGroupId('dm-1');

    expect(isContextViewedAndFocused(undefined, 'dm-1')).toBe(true);
  });

  it('returns false when focused but a different DM group is active', () => {
    setActiveDmGroupId('dm-other');

    expect(isContextViewedAndFocused(undefined, 'dm-1')).toBe(false);
  });

  it('returns false when neither channelId nor dmGroupId is provided', () => {
    expect(isContextViewedAndFocused(undefined, undefined)).toBe(false);
    expect(isContextViewedAndFocused(null, null)).toBe(false);
  });
});
