import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../test-utils';
import MobileCommunityDrawer from '../../components/Mobile/Navigation/MobileCommunityDrawer';

// Controllable current screen for the nav context mock.
const navState = vi.hoisted(() => ({ currentScreen: 'channels' as string }));
const openDrawer = vi.hoisted(() => vi.fn());

vi.mock('../../components/Mobile/Navigation/MobileNavigationContext', () => ({
  useMobileNavigation: () => ({
    state: { isDrawerOpen: false, currentScreen: navState.currentScreen, communityId: null },
    openDrawer,
    closeDrawer: vi.fn(),
    navigateToChannels: vi.fn(),
    navigateToDmList: vi.fn(),
  }),
}));

vi.mock('../../hooks/useReadReceipts', () => ({
  useReadReceipts: () => ({ totalDmUnreadCount: 0 }),
}));

vi.mock('../../hooks/useAuthenticatedImage', () => ({
  useAuthenticatedImage: () => ({ blobUrl: null }),
}));

vi.mock('../../api-client/@tanstack/react-query.gen', () => ({
  communityControllerFindAllMineOptions: () => ({ queryKey: ['communities'], queryFn: async () => [] }),
}));

// The SwipeArea (edge hit-zone for swipe-to-open) is only rendered when
// disableSwipeToOpen is false.
const hasSwipeArea = () => !!document.querySelector('[class*="SwipeArea-root"]');

describe('MobileCommunityDrawer edge swipe-to-open', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables swipe-to-open on the channels screen', () => {
    navState.currentScreen = 'channels';
    renderWithProviders(<MobileCommunityDrawer />);
    expect(hasSwipeArea()).toBe(true);
  });

  it('disables swipe-to-open on the chat screen', () => {
    navState.currentScreen = 'chat';
    renderWithProviders(<MobileCommunityDrawer />);
    expect(hasSwipeArea()).toBe(false);
  });

  it('disables swipe-to-open on the dm-list screen', () => {
    navState.currentScreen = 'dm-list';
    renderWithProviders(<MobileCommunityDrawer />);
    expect(hasSwipeArea()).toBe(false);
  });
});
