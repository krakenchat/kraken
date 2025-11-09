import { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../app/store";
import { useSocket } from "./useSocket";
import { useRoom } from "./useRoom";
import { useVoiceEvents } from "./useVoiceEvents";
import { useProfileQuery } from "../features/users/usersSlice";
import { useGetConnectionInfoQuery } from "../features/livekit/livekitApiSlice";
import { setShowVideoTiles } from "../features/voice/voiceSlice";
import {
  joinDmVoice,
  leaveDmVoice,
  toggleMicrophone,
  toggleCameraUnified,
  toggleScreenShareUnified,
  toggleDeafenUnified,
  switchAudioInputDevice,
  switchAudioOutputDevice,
  switchVideoInputDevice,
} from "../features/voice/voiceThunks";

export const useDmVoiceConnection = () => {
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocket();
  const voiceState = useSelector((state: RootState) => state.voice);
  const { room, setRoom, getRoom } = useRoom();
  const { data: user } = useProfileQuery();
  const { data: connectionInfo } = useGetConnectionInfoQuery();

  // Set up voice event listeners
  useVoiceEvents();

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

  const handleLeaveDmVoice = useCallback(async () => {
    await dispatch(
      leaveDmVoice({ socket: socket ?? undefined, getRoom, setRoom })
    ).unwrap();
  }, [dispatch, socket, getRoom, setRoom]);

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
    await dispatch(toggleDeafenUnified()).unwrap();
  }, [dispatch]);

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
      joinDmVoice: handleJoinDmVoice,
      leaveDmVoice: handleLeaveDmVoice,
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
