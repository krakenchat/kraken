import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// --- Mock livekit-client ---
vi.mock('livekit-client', () => ({
  RoomEvent: {
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    SignalConnected: 'signalConnected',
    Disconnected: 'disconnected',
    ConnectionStateChanged: 'connectionStateChanged',
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    TrackPublished: 'trackPublished',
    TrackUnpublished: 'trackUnpublished',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    TrackSubscriptionFailed: 'trackSubscriptionFailed',
    TrackSubscriptionStatusChanged: 'trackSubscriptionStatusChanged',
    ConnectionQualityChanged: 'connectionQualityChanged',
  },
  ConnectionQuality: {
    Excellent: 'excellent',
    Good: 'good',
    Poor: 'poor',
    Lost: 'lost',
  },
  Track: {
    Source: {
      Microphone: 'microphone',
      Camera: 'camera',
      ScreenShare: 'screen_share',
      ScreenShareAudio: 'screen_share_audio',
    },
  },
}));

type Listener = (...args: unknown[]) => void;

function createMockRoom() {
  const handlers = new Map<string, Set<Listener>>();
  return {
    state: 'connected',
    localParticipant: { identity: 'me' },
    on: vi.fn((event: string, handler: Listener) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Listener) => {
      handlers.get(event)?.delete(handler);
    }),
    emit: (event: string, ...args: unknown[]) =>
      handlers.get(event)?.forEach((h) => h(...args)),
  };
}

let mockRoom: ReturnType<typeof createMockRoom> | null = null;

vi.mock('../../hooks/useRoom', () => ({
  useRoom: vi.fn(() => ({ room: mockRoom })),
}));

import { VoiceEventLogProvider } from '../../hooks/useVoiceEventLog';
import { useVoiceEventLog } from '../../hooks/useVoiceEventLogDef';

function wrapWithProvider({ children }: { children: React.ReactNode }) {
  return <VoiceEventLogProvider>{children}</VoiceEventLogProvider>;
}

describe('useVoiceEventLog', () => {
  beforeEach(() => {
    mockRoom = createMockRoom();
  });

  it('returns null when used outside the provider', () => {
    const { result } = renderHook(() => useVoiceEventLog());
    expect(result.current).toBeNull();
  });

  it('records the initial "Room available" event when a room is present', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    expect(result.current?.events.length).toBe(1);
    expect(result.current?.events[0].message).toMatch(/Room available/);
    expect(result.current?.events[0].category).toBe('connection');
  });

  it('appends a Reconnected entry when the room emits the event', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    act(() => mockRoom!.emit('reconnected'));
    const messages = result.current!.events.map((e) => e.message);
    expect(messages.some((m) => m.includes('Reconnected'))).toBe(true);
  });

  it('logs participant connect/disconnect with severity', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    const alice = { identity: 'alice', name: 'Alice', trackPublications: new Map() };
    act(() => mockRoom!.emit('participantConnected', alice));
    act(() => mockRoom!.emit('participantDisconnected', alice));

    const events = result.current!.events;
    expect(events.find((e) => e.message.includes('Alice connected'))?.severity).toBe('success');
    expect(events.find((e) => e.message.includes('Alice disconnected'))?.severity).toBe('info');
  });

  it('logs track subscription failures as errors', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    const alice = { identity: 'alice', name: 'Alice' };
    act(() => mockRoom!.emit('trackSubscriptionFailed', 'sid-12345678', alice, 'codec_unsupported'));
    const failed = result.current!.events.find((e) => e.message.includes('FAILED'));
    expect(failed).toBeDefined();
    expect(failed!.severity).toBe('error');
  });

  it('only logs mic transitions for trackSubscriptionStatusChanged', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    const alice = { identity: 'alice', name: 'Alice' };
    const camPub = { source: 'camera', trackSid: 'cam-sid' };
    const micPub = { source: 'microphone', trackSid: 'mic-sid' };

    act(() => {
      mockRoom!.emit('trackSubscriptionStatusChanged', camPub, 'unsubscribed', alice);
      mockRoom!.emit('trackSubscriptionStatusChanged', micPub, 'unsubscribed', alice);
    });

    const subscriptionEvents = result.current!.events.filter((e) => e.category === 'subscription');
    expect(subscriptionEvents.length).toBe(1);
    expect(subscriptionEvents[0].message).toContain('mic subscription → unsubscribed');
    expect(subscriptionEvents[0].severity).toBe('error');
  });

  it('skips remote-participant quality changes that are excellent/good', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    const alice = { identity: 'alice', name: 'Alice' };
    act(() => mockRoom!.emit('connectionQualityChanged', 'excellent', alice));
    act(() => mockRoom!.emit('connectionQualityChanged', 'good', alice));

    const qualityEvents = result.current!.events.filter((e) => e.category === 'quality');
    expect(qualityEvents.length).toBe(0);
  });

  it('records remote-participant Poor and Lost quality changes', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    const alice = { identity: 'alice', name: 'Alice' };
    act(() => mockRoom!.emit('connectionQualityChanged', 'poor', alice));
    act(() => mockRoom!.emit('connectionQualityChanged', 'lost', alice));

    const qualityEvents = result.current!.events.filter((e) => e.category === 'quality');
    expect(qualityEvents.length).toBe(2);
    expect(qualityEvents[0].severity).toBe('warn');
    expect(qualityEvents[1].severity).toBe('error');
  });

  it('always records local-participant quality changes (any quality)', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    const local = { identity: 'me' };
    act(() => mockRoom!.emit('connectionQualityChanged', 'excellent', local));
    const qualityEvents = result.current!.events.filter((e) => e.category === 'quality');
    expect(qualityEvents.some((e) => e.message.includes('local quality'))).toBe(true);
  });

  it('clear() empties the event list', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    act(() => mockRoom!.emit('reconnected'));
    expect(result.current!.events.length).toBeGreaterThan(0);
    act(() => result.current!.clear());
    expect(result.current!.events.length).toBe(0);
  });

  it('caps the buffer at 250 entries (oldest dropped)', () => {
    const { result } = renderHook(() => useVoiceEventLog(), { wrapper: wrapWithProvider });
    const alice = { identity: 'alice', name: 'Alice', trackPublications: new Map() };
    act(() => {
      for (let i = 0; i < 300; i++) {
        mockRoom!.emit('participantConnected', alice);
      }
    });
    expect(result.current!.events.length).toBe(250);
  });
});
