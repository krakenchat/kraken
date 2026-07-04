import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// --- Mocks ---
const mutateAsync = vi.fn().mockResolvedValue({});
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutateAsync }),
}));
vi.mock('../../api-client/@tanstack/react-query.gen', () => ({
  pushNotificationsControllerSubscribeMutation: () => ({}),
}));

const getCurrentPushSubscription = vi.fn();
vi.mock('../../utils/pushSubscription', () => ({
  isPushSupported: () => true,
  getCurrentPushSubscription: () => getCurrentPushSubscription(),
  extractSubscriptionData: (sub: { endpoint: string }) => ({
    endpoint: sub.endpoint,
    keys: { p256dh: 'p', auth: 'a' },
    userAgent: 'test',
  }),
}));

const swDbGet = vi.fn();
const swDbSet = vi.fn().mockResolvedValue(undefined);
const swDbDelete = vi.fn().mockResolvedValue(undefined);
vi.mock('../../utils/swDb', () => ({
  swDbGet: (key: string) => swDbGet(key),
  swDbSet: (...args: unknown[]) => swDbSet(...args),
  swDbDelete: (...args: unknown[]) => swDbDelete(...args),
  SW_DB_KEYS: {
    applicationServerKey: 'push:applicationServerKey',
    apiBaseUrl: 'push:apiBaseUrl',
    lastSyncedEndpoint: 'push:lastSyncedEndpoint',
    pendingEndpoint: 'push:pendingEndpoint',
  },
}));

import { usePushResync } from '../../hooks/usePushResync';

describe('usePushResync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swDbSet.mockResolvedValue(undefined);
    swDbDelete.mockResolvedValue(undefined);
    mutateAsync.mockResolvedValue({});
  });

  it('re-POSTs the subscription when the endpoint has rotated', async () => {
    getCurrentPushSubscription.mockResolvedValue({ endpoint: 'https://push/new' });
    swDbGet.mockResolvedValue('https://push/old');

    renderHook(() => usePushResync());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      body: expect.objectContaining({ endpoint: 'https://push/new' }),
    });
    // records the new endpoint as synced and clears the pending marker
    expect(swDbSet).toHaveBeenCalledWith('push:lastSyncedEndpoint', 'https://push/new');
    expect(swDbDelete).toHaveBeenCalledWith('push:pendingEndpoint');
  });

  it('does nothing when the endpoint is unchanged', async () => {
    getCurrentPushSubscription.mockResolvedValue({ endpoint: 'https://push/same' });
    swDbGet.mockResolvedValue('https://push/same');

    renderHook(() => usePushResync());

    await waitFor(() => expect(getCurrentPushSubscription).toHaveBeenCalled());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('does nothing when there is no active subscription', async () => {
    getCurrentPushSubscription.mockResolvedValue(null);
    swDbGet.mockResolvedValue('https://push/old');

    renderHook(() => usePushResync());

    await waitFor(() => expect(getCurrentPushSubscription).toHaveBeenCalled());
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
