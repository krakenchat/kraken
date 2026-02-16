import React, { Suspense, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./Layout";
import CssBaseline from "@mui/material/CssBaseline";
import { CircularProgress, Box } from "@mui/material";
import { RoomProvider } from "./contexts/RoomContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AvatarCacheProvider } from "./contexts/AvatarCacheContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { ThreadPanelProvider } from "./contexts/ThreadPanelContext";
import { VoiceProvider } from "./contexts/VoiceContext";
import { useQuery } from "@tanstack/react-query";
import { onboardingControllerGetStatusOptions } from "./api-client/@tanstack/react-query.gen";
import AutoUpdater from "./components/Electron/AutoUpdater";
import { ConnectionWizard } from "./components/Electron/ConnectionWizard";
import { PWAInstallPrompt } from "./components/PWA/PWAInstallPrompt";
import { ConnectionStatusBanner } from "./components/ConnectionStatusBanner";
import { hasServers } from "./utils/serverStorage";
import { isElectron } from "./utils/platform";

// Eager imports - first-paint routes
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";

// Lazy-loaded routes
const HomePage = React.lazy(() => import("./pages/HomePage"));
const CreateCommunityPage = React.lazy(() => import("./pages/CreateCommunityPage"));
const EditCommunityPage = React.lazy(() => import("./pages/EditCommunityPage"));
const JoinInvitePage = React.lazy(() => import("./pages/JoinInvitePage"));
const AdminInvitePage = React.lazy(() => import("./pages/AdminInvitePage"));
const AdminLayout = React.lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = React.lazy(() => import("./pages/admin").then(m => ({ default: m.AdminDashboard })));
const AdminUsersPage = React.lazy(() => import("./pages/admin").then(m => ({ default: m.AdminUsersPage })));
const AdminCommunitiesPage = React.lazy(() => import("./pages/admin").then(m => ({ default: m.AdminCommunitiesPage })));
const AdminSettingsPage = React.lazy(() => import("./pages/admin").then(m => ({ default: m.AdminSettingsPage })));
const AdminRolesPage = React.lazy(() => import("./pages/admin").then(m => ({ default: m.AdminRolesPage })));
const AdminStoragePage = React.lazy(() => import("./pages/admin").then(m => ({ default: m.AdminStoragePage })));
const NotificationDebugPage = React.lazy(() => import("./pages/debug/NotificationDebugPage"));
const DirectMessagesPage = React.lazy(() => import("./pages/DirectMessagesPage"));
const FriendsPage = React.lazy(() => import("./pages/FriendsPage"));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"));
const ProfileEditPage = React.lazy(() => import("./pages/ProfileEditPage"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const CommunityPage = React.lazy(() => import("./pages/CommunityPage"));
const NotFoundPage = React.lazy(() => import("./pages/NotFoundPage"));

function App() {
  const location = useLocation();
  const token = localStorage.getItem("accessToken");

  // Check if running in Electron and needs server configuration
  const needsServerSetup = isElectron() && !hasServers();
  const [showWizard, setShowWizard] = useState(needsServerSetup);

  // Check if onboarding is needed - but only make the request if we're not already on the onboarding page
  const shouldCheckOnboarding = location.pathname !== "/onboarding";
  const { data: onboardingStatus, isLoading: isCheckingOnboarding } = useQuery({
    ...onboardingControllerGetStatusOptions(),
    enabled: shouldCheckOnboarding && !showWizard,
  });

  // Show connection wizard for Electron if no servers configured
  if (showWizard) {
    return (
      <ThemeProvider>
        <CssBaseline />
        <AutoUpdater />
        <ConnectionWizard
          open={true}
          onComplete={() => {
            setShowWizard(false);
            // Reload the page to pick up the new server configuration
            window.location.reload();
          }}
        />
      </ThemeProvider>
    );
  }
  
  // Allow access to certain routes without authentication
  const publicRoutes = ["/login", "/register", "/join", "/onboarding"];
  const isPublicRoute = publicRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(route + "/")
  );
  
  // Show loading spinner while checking onboarding status
  if (shouldCheckOnboarding && isCheckingOnboarding) {
    return (
      <ThemeProvider>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }
  
  // Redirect to onboarding if setup is needed
  if (onboardingStatus?.needsSetup && location.pathname !== "/onboarding") {
    return (
      <ThemeProvider>
        <CssBaseline />
        <AutoUpdater />
        <OnboardingPage />
      </ThemeProvider>
    );
  }

  if (!token && !isPublicRoute) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ThemeProvider>
      <CssBaseline />
      <AutoUpdater />
      <PWAInstallPrompt />
      <AvatarCacheProvider>
        <NotificationProvider>
          <VoiceProvider>
          {token && !isPublicRoute && <ConnectionStatusBanner />}
          <RoomProvider>
            <ThreadPanelProvider>
            <UserProfileProvider>
            <Suspense fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
              </Box>
            }>
            <Routes>
              {/* Public routes */}
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/join/:inviteCode" element={<JoinInvitePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Authenticated routes */}
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="direct-messages" element={<DirectMessagesPage />} />
                <Route path="friends" element={<FriendsPage />} />
                <Route path="settings" element={<SettingsPage />} />

                {/* Admin routes with dedicated layout */}
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="communities" element={<AdminCommunitiesPage />} />
                  <Route path="invites" element={<AdminInvitePage />} />
                  <Route path="roles" element={<AdminRolesPage />} />
                  <Route path="storage" element={<AdminStoragePage />} />
                  <Route path="settings" element={<AdminSettingsPage />} />
                </Route>

                {/* Debug routes (admin only - access check in component) */}
                <Route path="debug/notifications" element={<NotificationDebugPage />} />
                <Route path="profile/edit" element={<ProfileEditPage />} />
                <Route path="profile/:userId" element={<ProfilePage />} />
                <Route path="community/create" element={<CreateCommunityPage />} />
                <Route path="community/:communityId">
                  <Route index element={<CommunityPage />} />
                  <Route path="edit" element={<EditCommunityPage />} />
                  <Route path="channel/:channelId" element={<CommunityPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
            </Suspense>
            </UserProfileProvider>
            </ThreadPanelProvider>
          </RoomProvider>
          </VoiceProvider>
        </NotificationProvider>
      </AvatarCacheProvider>
    </ThemeProvider>
  );
}

export default App;
