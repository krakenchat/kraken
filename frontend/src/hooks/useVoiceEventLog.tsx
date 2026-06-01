import React, { useEffect, useRef } from 'react';
import { RoomEvent, ConnectionQuality, Track } from 'livekit-client';
import type {
  RemoteParticipant,
  RemoteTrackPublication,
  Participant,
  TrackPublication,
  RemoteTrack,
  SubscriptionError,
  DisconnectReason,
  ConnectionState,
} from 'livekit-client';
import { useRoom } from './useRoom';
import {
  VoiceEventLogContext,
  type VoiceEventEntry,
  type VoiceEventLogStore,
  type VoiceEventSeverity,
} from './useVoiceEventLogDef';

const MAX_EVENTS = 250;

/**
 * Creates a store that holds the event ring buffer outside React state.
 * Writes don't trigger Provider re-renders; consumers update via
 * useSyncExternalStore subscription.
 */
function createVoiceEventLogStore(): VoiceEventLogStore {
  let events: VoiceEventEntry[] = [];
  let idCounter = 0;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((l) => l());

  return {
    getSnapshot: () => events,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    push: (entry) => {
      const next = events.length >= MAX_EVENTS ? events.slice(events.length - MAX_EVENTS + 1) : events.slice();
      next.push({
        ...entry,
        id: idCounter++,
        timestamp: Date.now(),
      });
      events = next;
      notify();
    },
    clear: () => {
      if (events.length === 0 && idCounter === 0) return;
      events = [];
      idCounter = 0;
      notify();
    },
  };
}

/**
 * Subscribes to a room's lifecycle and subscription events whenever a Room is
 * available, recording each one into a ring buffer. Mount this once per app
 * (next to TrackSubscriptionProvider) so the log starts collecting immediately
 * on voice join — not only when the debug panel is opened.
 *
 * The buffer is reset whenever the underlying Room reference changes (e.g.
 * the user leaves voice or joins a different channel) so events from prior
 * sessions don't bleed into the next.
 *
 * Chatty/uninteresting events (active speakers, data packets, transcription)
 * are intentionally filtered out to keep the log readable.
 */
export const VoiceEventLogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { room } = useRoom();
  const storeRef = useRef<VoiceEventLogStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createVoiceEventLogStore();
  }
  const store = storeRef.current;

  useEffect(() => {
    // Reset on room changes so the log only contains events for the current
    // session. `null → Room` (joining), `Room → null` (leaving), and
    // `RoomA → RoomB` (channel switch) all clear the buffer.
    store.clear();

    if (!room) return;

    store.push({
      severity: 'success',
      category: 'connection',
      message: `Room available (state: ${room.state})`,
    });

    // ---------------- Connection lifecycle ----------------
    const onReconnecting = () =>
      store.push({ severity: 'warn', category: 'connection', message: 'Reconnecting…' });
    const onReconnected = () =>
      store.push({
        severity: 'success',
        category: 'connection',
        message: 'Reconnected — re-subscribing to mics',
      });
    const onSignalConnected = () =>
      store.push({ severity: 'info', category: 'connection', message: 'Signal connected' });
    const onDisconnected = (reason?: DisconnectReason) =>
      store.push({
        severity: 'error',
        category: 'connection',
        message: `Disconnected${reason !== undefined ? ` (reason: ${reason})` : ''}`,
      });
    const onConnectionStateChanged = (state: ConnectionState) =>
      store.push({
        severity: 'info',
        category: 'connection',
        message: `Connection state → ${state}`,
      });

    // ---------------- Participants ----------------
    const onParticipantConnected = (p: RemoteParticipant) =>
      store.push({
        severity: 'success',
        category: 'participant',
        message: `${shortName(p)} connected (${p.trackPublications.size} tracks)`,
      });
    const onParticipantDisconnected = (p: RemoteParticipant) =>
      store.push({
        severity: 'info',
        category: 'participant',
        message: `${shortName(p)} disconnected`,
      });

    // ---------------- Tracks (publish/unpublish) ----------------
    const onTrackPublished = (pub: RemoteTrackPublication, p: RemoteParticipant) =>
      store.push({
        severity: 'info',
        category: 'track',
        message: `${shortName(p)} published ${pub.source} (${pub.trackSid.slice(0, 8)}…)`,
      });
    const onTrackUnpublished = (pub: RemoteTrackPublication, p: RemoteParticipant) =>
      store.push({
        severity: 'info',
        category: 'track',
        message: `${shortName(p)} unpublished ${pub.source}`,
      });
    const onTrackMuted = (pub: TrackPublication, p: Participant) => {
      // Only log mic mutes — video mute is noisy and less actionable here.
      if (pub.source !== Track.Source.Microphone) return;
      store.push({ severity: 'info', category: 'track', message: `${shortName(p)} muted mic` });
    };
    const onTrackUnmuted = (pub: TrackPublication, p: Participant) => {
      if (pub.source !== Track.Source.Microphone) return;
      store.push({ severity: 'info', category: 'track', message: `${shortName(p)} unmuted mic` });
    };

    // ---------------- Subscriptions (the asymmetric-audio signal) ----------------
    const onTrackSubscribed = (
      _track: RemoteTrack,
      pub: RemoteTrackPublication,
      p: RemoteParticipant,
    ) =>
      store.push({
        severity: 'success',
        category: 'subscription',
        message: `subscribed to ${shortName(p)}'s ${pub.source}`,
      });
    const onTrackUnsubscribed = (
      _track: RemoteTrack,
      pub: RemoteTrackPublication,
      p: RemoteParticipant,
    ) =>
      store.push({
        severity: 'warn',
        category: 'subscription',
        message: `unsubscribed from ${shortName(p)}'s ${pub.source}`,
      });
    const onTrackSubscriptionFailed = (
      trackSid: string,
      p: RemoteParticipant,
      reason?: SubscriptionError,
    ) =>
      store.push({
        severity: 'error',
        category: 'subscription',
        message: `subscription FAILED for ${shortName(p)} (${trackSid.slice(0, 8)}…)${
          reason !== undefined ? ` — ${reason}` : ''
        }`,
      });
    const onTrackSubscriptionStatusChanged = (
      pub: RemoteTrackPublication,
      status: TrackPublication.SubscriptionStatus,
      p: RemoteParticipant,
    ) => {
      if (pub.source !== Track.Source.Microphone) return;
      const severity: VoiceEventSeverity =
        status === 'subscribed' ? 'success' : status === 'unsubscribed' ? 'error' : 'info';
      store.push({
        severity,
        category: 'subscription',
        message: `${shortName(p)} mic subscription → ${status}`,
      });
    };

    // ---------------- Quality ----------------
    // Always log local quality; for remotes, only log Poor/Lost transitions.
    const onConnectionQualityChanged = (quality: ConnectionQuality, p: Participant) => {
      const isLocal = p.identity === room.localParticipant.identity;
      if (!isLocal && quality !== ConnectionQuality.Poor && quality !== ConnectionQuality.Lost) {
        return;
      }
      const severity: VoiceEventSeverity =
        quality === ConnectionQuality.Lost
          ? 'error'
          : quality === ConnectionQuality.Poor
          ? 'warn'
          : 'info';
      store.push({
        severity,
        category: 'quality',
        message: `${isLocal ? 'local' : shortName(p)} quality → ${quality}`,
      });
    };

    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.SignalConnected, onSignalConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
    room.on(RoomEvent.TrackSubscriptionStatusChanged, onTrackSubscriptionStatusChanged);
    room.on(RoomEvent.ConnectionQualityChanged, onConnectionQualityChanged);

    return () => {
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.SignalConnected, onSignalConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
      room.off(RoomEvent.TrackMuted, onTrackMuted);
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
      room.off(RoomEvent.TrackSubscriptionStatusChanged, onTrackSubscriptionStatusChanged);
      room.off(RoomEvent.ConnectionQualityChanged, onConnectionQualityChanged);
    };
  }, [room, store]);

  return <VoiceEventLogContext.Provider value={store}>{children}</VoiceEventLogContext.Provider>;
};

function shortName(p: { name?: string; identity: string }): string {
  return p.name && p.name.length > 0 ? p.name : p.identity.slice(0, 8);
}
