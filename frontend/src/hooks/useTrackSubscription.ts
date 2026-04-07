import { useEffect, useCallback, createContext, useContext } from 'react';
import {
  RoomEvent,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
} from 'livekit-client';
import { useRoom } from './useRoom';
import { useVoiceDispatch, VoiceActionType } from '../contexts/VoiceContext';
import { logger } from '../utils/logger';

/**
 * Unsubscribes a remote track publication from the SFU (saves bandwidth).
 */
function unsubscribePublication(publication: RemoteTrackPublication, reason: string) {
  if (publication.isSubscribed || publication.subscriptionStatus === 'desired') {
    logger.info('[TrackSubscription] Unsubscribing', reason, publication.trackSid, publication.source);
    publication.setSubscribed(false);
  }
}

/**
 * Checks if a track source is a video source that should be opt-in.
 */
function isOptInSource(source: Track.Source | string): boolean {
  return (
    source === Track.Source.Camera ||
    source === Track.Source.ScreenShare ||
    source === Track.Source.ScreenShareAudio
  );
}

/**
 * Iterates a remote participant's track publications and unsubscribes all opt-in sources.
 */
function unsubscribeAllOptInTracks(participant: RemoteParticipant) {
  for (const [, publication] of participant.trackPublications) {
    if (isOptInSource(publication.source) && publication instanceof RemoteTrackPublication) {
      unsubscribePublication(publication, `initial-unsubscribe:${participant.identity}`);
    }
  }
}

export interface TrackSubscriptionActions {
  watchCamera: (identity: string) => void;
  stopWatchingCamera: (identity: string) => void;
  watchScreenShare: (identity: string) => void;
  stopWatchingScreenShare: (identity: string) => void;
}

export const TrackSubscriptionContext = createContext<TrackSubscriptionActions | null>(null);

export function useTrackSubscriptionActions(): TrackSubscriptionActions | null {
  return useContext(TrackSubscriptionContext);
}

/**
 * Hook that manages per-participant track subscriptions via LiveKit's setSubscribed API.
 *
 * - Mic tracks: always auto-subscribed (do nothing)
 * - Camera/ScreenShare/ScreenShareAudio: immediately unsubscribed on publish,
 *   then selectively re-subscribed when the user opts in via watch/stop actions.
 *
 * Returns actions to be provided via TrackSubscriptionContext.
 */
export function useTrackSubscription(): TrackSubscriptionActions {
  const { room } = useRoom();
  const { dispatch } = useVoiceDispatch();

  // --- Event handlers: unsubscribe on publish, cleanup on unpublish ---

  useEffect(() => {
    if (!room) return;

    const handleTrackPublished = (
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (!isOptInSource(publication.source)) return;
      unsubscribePublication(publication, `published:${participant.identity}`);
    };

    const handleTrackUnpublished = (
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      // Clean up watching state when a participant stops sharing
      if (publication.source === Track.Source.Camera) {
        dispatch({ type: VoiceActionType.StopWatchingCamera, payload: participant.identity });
      } else if (publication.source === Track.Source.ScreenShare) {
        dispatch({ type: VoiceActionType.StopWatchingScreenShare, payload: participant.identity });
      }
    };

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      // Participant may already have published tracks by the time we get this event
      unsubscribeAllOptInTracks(participant);
    };

    // Unsubscribe existing participants' opt-in tracks on mount
    for (const [, participant] of room.remoteParticipants) {
      unsubscribeAllOptInTracks(participant);
    }

    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    return () => {
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [room, dispatch]);

  // --- Watch/stop actions ---

  const findParticipant = useCallback(
    (identity: string): RemoteParticipant | undefined => {
      if (!room) return undefined;
      for (const [, p] of room.remoteParticipants) {
        if (p.identity === identity) return p;
      }
      return undefined;
    },
    [room],
  );

  const setSubscribedForSource = useCallback(
    (identity: string, sources: Track.Source[], subscribed: boolean) => {
      const participant = findParticipant(identity);
      if (!participant) {
        logger.warn('[TrackSubscription] Participant not found:', identity);
        return;
      }
      for (const [, publication] of participant.trackPublications) {
        if (
          sources.includes(publication.source as Track.Source) &&
          publication instanceof RemoteTrackPublication
        ) {
          logger.info(
            '[TrackSubscription]',
            subscribed ? 'Subscribing' : 'Unsubscribing',
            identity,
            publication.source,
            publication.trackSid,
          );
          publication.setSubscribed(subscribed);
        }
      }
    },
    [findParticipant],
  );

  const watchCamera = useCallback(
    (identity: string) => {
      setSubscribedForSource(identity, [Track.Source.Camera], true);
      dispatch({ type: VoiceActionType.WatchCamera, payload: identity });
    },
    [setSubscribedForSource, dispatch],
  );

  const stopWatchingCamera = useCallback(
    (identity: string) => {
      setSubscribedForSource(identity, [Track.Source.Camera], false);
      dispatch({ type: VoiceActionType.StopWatchingCamera, payload: identity });
    },
    [setSubscribedForSource, dispatch],
  );

  const watchScreenShare = useCallback(
    (identity: string) => {
      setSubscribedForSource(
        identity,
        [Track.Source.ScreenShare, Track.Source.ScreenShareAudio],
        true,
      );
      dispatch({ type: VoiceActionType.WatchScreenShare, payload: identity });
    },
    [setSubscribedForSource, dispatch],
  );

  const stopWatchingScreenShare = useCallback(
    (identity: string) => {
      setSubscribedForSource(
        identity,
        [Track.Source.ScreenShare, Track.Source.ScreenShareAudio],
        false,
      );
      dispatch({ type: VoiceActionType.StopWatchingScreenShare, payload: identity });
    },
    [setSubscribedForSource, dispatch],
  );

  return { watchCamera, stopWatchingCamera, watchScreenShare, stopWatchingScreenShare };
}
