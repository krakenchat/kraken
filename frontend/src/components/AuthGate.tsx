import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { onboardingControllerGetStatusOptions } from "../api-client/@tanstack/react-query.gen";
import {
  getAccessToken,
  isTokenExpired,
  refreshToken,
  clearTokens,
} from "../utils/tokenService";
import { SocketProvider } from "../utils/SocketProvider";
import { AvatarCacheProvider } from "../contexts/AvatarCacheContext";
import { NotificationProvider } from "../contexts/NotificationContext";
import { VoiceProvider } from "../contexts/VoiceContext";
import { ConnectionStatusBanner } from "./ConnectionStatusBanner";
import { RoomProvider } from "../contexts/RoomContext";
import { ThreadPanelProvider } from "../contexts/ThreadPanelContext";
import { UserProfileProvider } from "../contexts/UserProfileContext";
import { logger } from "../utils/logger";

type AuthState = "loading" | "needs-onboarding" | "unauthenticated" | "authenticated";

export function AuthGate() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  // Phase 1: Onboarding check (no auth required)
  const {
    data: onboardingStatus,
    isLoading: isCheckingOnboarding,
    isSuccess: onboardingChecked,
    isError: onboardingCheckFailed,
  } = useQuery(onboardingControllerGetStatusOptions());

  // Phase 2: Token validation (runs after onboarding check completes)
  useEffect(() => {
    // Still checking onboarding
    if (isCheckingOnboarding) return;

    // Onboarding needed
    if (onboardingChecked && onboardingStatus?.needsSetup) {
      setAuthState("needs-onboarding");
      return;
    }

    // Onboarding check failed — could be network error on first load.
    // Fall through to token check so the app doesn't get stuck.
    // If server is unreachable, authenticated requests will also fail.

    // Onboarding done (or check failed) → validate token
    if (onboardingChecked || onboardingCheckFailed) {
      validateToken();
    }
  }, [isCheckingOnboarding, onboardingChecked, onboardingCheckFailed, onboardingStatus]);

  async function validateToken() {
    const token = getAccessToken();

    if (!token) {
      setAuthState("unauthenticated");
      return;
    }

    if (!isTokenExpired(token)) {
      // Token looks valid — proceed
      setAuthState("authenticated");
      return;
    }

    // Token is expired — attempt refresh
    logger.dev("[AuthGate] Token expired, attempting refresh...");
    try {
      const newToken = await refreshToken();
      if (newToken) {
        setAuthState("authenticated");
      } else {
        clearTokens();
        setAuthState("unauthenticated");
      }
    } catch {
      clearTokens();
      setAuthState("unauthenticated");
    }
  }

  if (authState === "loading") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Connecting...
        </Typography>
      </Box>
    );
  }

  if (authState === "needs-onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (authState === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  // Authenticated — render providers and child routes
  return (
    <SocketProvider>
      <AvatarCacheProvider>
        <NotificationProvider>
          <VoiceProvider>
            <ConnectionStatusBanner />
            <RoomProvider>
              <ThreadPanelProvider>
                <UserProfileProvider>
                  <Outlet />
                </UserProfileProvider>
              </ThreadPanelProvider>
            </RoomProvider>
          </VoiceProvider>
        </NotificationProvider>
      </AvatarCacheProvider>
    </SocketProvider>
  );
}

export default AuthGate;
