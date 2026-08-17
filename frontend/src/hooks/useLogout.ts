import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authControllerLogoutMutation } from "../api-client/@tanstack/react-query.gen";
import { useVoiceConnection } from "./useVoiceConnection";
import { disconnectSocket } from "../utils/socketSingleton";
import { clearSavedConnection } from "../features/voice/voiceActions";
import { clearTokens, getElectronRefreshToken } from "../utils/tokenService";
import { isElectron } from "../utils/platform";

/**
 * Encapsulates the app's logout flow: leave voice (best effort), tear down
 * the local voice connection + socket state, call the logout mutation
 * (sending the Electron refresh token in the body when applicable), clear
 * tokens, then navigate to /login.
 */
export function useLogout() {
  const navigate = useNavigate();
  const { mutateAsync: logout, isPending: logoutLoading } = useMutation(authControllerLogoutMutation());
  const { state: voiceState, actions: voiceActions } = useVoiceConnection();

  const handleLogout = async () => {
    // Disconnect voice if connected
    if (voiceState.isConnected) {
      try {
        await voiceActions.leaveVoiceChannel();
      } catch {
        // Best effort — don't block logout
      }
    }
    clearSavedConnection();
    disconnectSocket();
    // Electron clients must send refresh token in body since cookies don't work cross-origin
    const refreshToken = isElectron() ? (await getElectronRefreshToken()) ?? undefined : undefined;
    await logout({ body: { refreshToken } });
    clearTokens();
    navigate("/login");
  };

  return { handleLogout, logoutLoading };
}
