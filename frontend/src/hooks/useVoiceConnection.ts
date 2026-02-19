import { useCallback } from "react";
import { useVoice, useVoiceDispatch } from "../contexts/VoiceContext";
import { useRoom } from "./useRoom";
import { useQuery } from "@tanstack/react-query";
import { userControllerGetProfileOptions, livekitControllerGetConnectionInfoOptions } from "../api-client/@tanstack/react-query.gen";
import { logger } from "../utils/logger";
import {
  joinVoiceChannel,
  leaveVoiceChannel,
  joinDmVoice,
  leaveDmVoice,
  toggleMicrophone,
  toggleCameraUnified,
  toggleScreenShareUnified,
  toggleDeafenUnified,
  switchAudioInputDevice,
  switchAudioOutputDevice,
  switchVideoInputDevice,
} from "../features/voice/voiceActions";

export const useVoiceConnection = () => {
  const voiceState = useVoice();
  const { dispatch, stateRef } = useVoiceDispatch();
  const { room, setRoom, getRoom } = useRoom();
  const { data: user } = useQuery(userControllerGetProfileOptions());
  const { data: connectionInfo } = useQuery(livekitControllerGetConnectionInfoOptions());

  const getDeps = useCallback(() => ({
    dispatch,
    getVoiceState: () => stateRef.current,
    getRoom,
    setRoom,
  }), [dispatch, stateRef, getRoom, setRoom]);

  const handleJoinVoiceChannel = useCallback(
    async (
      channelId: string,
      channelName: string,
      communityId: string,
      isPrivate: boolean,
      createdAt: string
    ) => {
      logger.info('[useVoiceConnection] handleJoinVoiceChannel called');
      logger.info('[useVoiceConnection] user:', user?.id, 'connectionInfo:', !!connectionInfo);

      if (!user || !connectionInfo) {
        logger.error('[useVoiceConnection] Missing user or connectionInfo');
        throw new Error("User or connection info not available");
      }

      // Leave current channel/DM before joining a new one
      const deps = getDeps();
      const currentState = deps.getVoiceState();
      if (currentState.isConnected) {
        logger.info('[useVoiceConnection] Already connected, leaving current channel first');
        if (currentState.contextType === 'dm') {
          await leaveDmVoice(deps);
        } else {
          await leaveVoiceChannel(deps);
        }
      }

      logger.info('[useVoiceConnection] Calling joinVoiceChannel...');
      await joinVoiceChannel(
        {
          channelId,
          channelName,
          communityId,
          isPrivate,
          createdAt,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName ?? undefined,
          },
          connectionInfo,
        },
        getDeps()
      );
      logger.info('[useVoiceConnection] joinVoiceChannel completed');
    },
    [user, connectionInfo, getDeps]
  );

  const handleJoinDmVoice = useCallback(
    async (dmGroupId: string, dmGroupName: string) => {
      if (!user || !connectionInfo) {
        throw new Error("User or connection info not available");
      }

      // Leave current channel/DM before joining a new one
      const deps = getDeps();
      const currentState = deps.getVoiceState();
      if (currentState.isConnected) {
        logger.info('[useVoiceConnection] Already connected, leaving current channel/DM first');
        if (currentState.contextType === 'dm') {
          await leaveDmVoice(deps);
        } else {
          await leaveVoiceChannel(deps);
        }
      }

      await joinDmVoice(
        {
          dmGroupId,
          dmGroupName,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName ?? undefined,
          },
          connectionInfo,
        },
        getDeps()
      );
    },
    [user, connectionInfo, getDeps]
  );

  const handleLeaveVoiceChannel = useCallback(async () => {
    const deps = getDeps();
    if (deps.getVoiceState().contextType === 'dm') {
      await leaveDmVoice(deps);
    } else {
      await leaveVoiceChannel(deps);
    }
  }, [getDeps]);

  const handleToggleAudio = useCallback(async () => {
    await toggleMicrophone(getDeps());
  }, [getDeps]);

  const handleToggleVideo = useCallback(async () => {
    await toggleCameraUnified(getDeps());
  }, [getDeps]);

  const handleToggleScreenShare = useCallback(async () => {
    await toggleScreenShareUnified(getDeps());
  }, [getDeps]);

  const handleToggleMute = useCallback(async () => {
    await toggleMicrophone(getDeps());
  }, [getDeps]);

  const handleToggleDeafen = useCallback(async () => {
    await toggleDeafenUnified(getDeps());
  }, [getDeps]);

  const handleSetShowVideoTiles = useCallback(
    (show: boolean) => {
      dispatch({ type: 'SET_SHOW_VIDEO_TILES', payload: show });
    },
    [dispatch]
  );

  const handleSwitchAudioInputDevice = useCallback(
    async (deviceId: string) => {
      await switchAudioInputDevice(deviceId, getDeps());
    },
    [getDeps]
  );

  const handleSwitchAudioOutputDevice = useCallback(
    async (deviceId: string) => {
      await switchAudioOutputDevice(deviceId, getDeps());
    },
    [getDeps]
  );

  const handleSwitchVideoInputDevice = useCallback(
    async (deviceId: string) => {
      await switchVideoInputDevice(deviceId, getDeps());
    },
    [getDeps]
  );

  const handleRequestMaximize = useCallback(() => {
    dispatch({ type: 'SET_REQUEST_MAXIMIZE', payload: true });
  }, [dispatch]);

  return {
    state: { ...voiceState, room },
    actions: {
      joinVoiceChannel: handleJoinVoiceChannel,
      joinDmVoice: handleJoinDmVoice,
      leaveVoiceChannel: handleLeaveVoiceChannel,
      toggleAudio: handleToggleAudio,
      toggleVideo: handleToggleVideo,
      toggleScreenShare: handleToggleScreenShare,
      toggleMute: handleToggleMute,
      toggleDeafen: handleToggleDeafen,
      setShowVideoTiles: handleSetShowVideoTiles,
      switchAudioInputDevice: handleSwitchAudioInputDevice,
      switchAudioOutputDevice: handleSwitchAudioOutputDevice,
      switchVideoInputDevice: handleSwitchVideoInputDevice,
      requestMaximize: handleRequestMaximize,
    },
  };
};
