import { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../app/store";
import { useSocket } from "./useSocket";
import { useRoom } from "./useRoom";
import { useProfileQuery } from "../features/users/usersSlice";
import { useGetConnectionInfoQuery } from "../features/livekit/livekitApiSlice";
import { setShowVideoTiles } from "../features/voice/voiceSlice";
import {
  joinVoiceChannel,
  leaveVoiceChannel,
  joinDmVoice,
  leaveDmVoice,
  switchAudioInputDevice,
  switchAudioOutputDevice,
  switchVideoInputDevice,
  // Unified thunks (replace duplicate channel/DM versions)
  toggleMicrophone,
  toggleCameraUnified,
  toggleScreenShareUnified,
  toggleDeafenUnified,
} from "../features/voice/voiceThunks";

export const useVoiceConnection = () => {
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocket();
  const voiceState = useSelector((state: RootState) => state.voice);
  const { room, setRoom, getRoom } = useRoom();
  const { data: user } = useProfileQuery();
  const { data: connectionInfo } = useGetConnectionInfoQuery();

  const handleJoinVoiceChannel = useCallback(
    async (
      channelId: string,
      channelName: string,
      communityId: string,
      isPrivate: boolean,
      createdAt: string
    ) => {
      if (!user || !connectionInfo) {
        throw new Error("User or connection info not available");
      }

      await dispatch(
        joinVoiceChannel({
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
          socket: socket ?? undefined,
          setRoom,
        })
      ).unwrap();
    },
    [dispatch, user, connectionInfo, socket, setRoom]
  );

  const handleJoinDmVoice = useCallback(
    async (dmGroupId: string, dmGroupName: string) => {
      if (!user || !connectionInfo) {
        throw new Error("User or connection info not available");
      }

      await dispatch(
        joinDmVoice({
          dmGroupId,
          dmGroupName,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName ?? undefined,
          },
          connectionInfo,
          socket: socket ?? undefined,
          setRoom,
        })
      ).unwrap();
    },
    [dispatch, user, connectionInfo, socket, setRoom]
  );

  const handleLeaveVoiceChannel = useCallback(async () => {
    // Use the correct leave action based on context
    if (voiceState.contextType === 'dm') {
      await dispatch(
        leaveDmVoice({ socket: socket ?? undefined, getRoom, setRoom })
      ).unwrap();
    } else {
      await dispatch(
        leaveVoiceChannel({ socket: socket ?? undefined, getRoom, setRoom })
      ).unwrap();
    }
  }, [dispatch, socket, getRoom, setRoom, voiceState.contextType]);

  // Unified handlers (no longer need to check contextType - thunks handle it)
  const handleToggleAudio = useCallback(async () => {
    await dispatch(toggleMicrophone({ getRoom })).unwrap();
  }, [dispatch, getRoom]);

  const handleToggleVideo = useCallback(async () => {
    await dispatch(toggleCameraUnified({ getRoom })).unwrap();
  }, [dispatch, getRoom]);

  const handleToggleScreenShare = useCallback(async () => {
    await dispatch(toggleScreenShareUnified({ getRoom })).unwrap();
  }, [dispatch, getRoom]);

  const handleToggleMute = useCallback(async () => {
    // toggleMicrophone replaces both toggleAudio and toggleMute
    await dispatch(toggleMicrophone({ getRoom })).unwrap();
  }, [dispatch, getRoom]);

  const handleToggleDeafen = useCallback(async () => {
    await dispatch(toggleDeafenUnified({ getRoom })).unwrap();
  }, [dispatch, getRoom]);

  const handleSetShowVideoTiles = useCallback(
    (show: boolean) => {
      dispatch(setShowVideoTiles(show));
    },
    [dispatch]
  );

  const handleSwitchAudioInputDevice = useCallback(
    async (deviceId: string) => {
      await dispatch(switchAudioInputDevice({ deviceId, getRoom })).unwrap();
    },
    [dispatch, getRoom]
  );

  const handleSwitchAudioOutputDevice = useCallback(
    async (deviceId: string) => {
      await dispatch(switchAudioOutputDevice({ deviceId, getRoom })).unwrap();
    },
    [dispatch, getRoom]
  );

  const handleSwitchVideoInputDevice = useCallback(
    async (deviceId: string) => {
      await dispatch(switchVideoInputDevice({ deviceId, getRoom })).unwrap();
    },
    [dispatch, getRoom]
  );

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
    },
  };
};
