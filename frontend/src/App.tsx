import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./Layout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import RegisterPage from "./pages/RegisterPage";
import CreateCommunityPage from "./pages/CreateCommunityPage";
import EditCommunityPage from "./pages/EditCommunityPage";
import JoinInvitePage from "./pages/JoinInvitePage";
import AdminInvitePage from "./pages/AdminInvitePage";
import AdminLayout from "./components/admin/AdminLayout";
import {
  AdminDashboard,
  AdminUsersPage,
  AdminCommunitiesPage,
  AdminSettingsPage,
  AdminRolesPage,
  AdminStoragePage,
} from "./pages/admin";
import OnboardingPage from "./pages/OnboardingPage";
import DirectMessagesPage from "./pages/DirectMessagesPage";
import FriendsPage from "./pages/FriendsPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileEditPage from "./pages/ProfileEditPage";
import SettingsPage from "./pages/SettingsPage";
import CssBaseline from "@mui/material/CssBaseline";
import CommunityPage from "./pages/CommunityPage";
import { RoomProvider } from "./contexts/RoomContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AvatarCacheProvider } from "./contexts/AvatarCacheContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { useGetOnboardingStatusQuery } from "./features/onboarding/onboardingApiSlice";
import { CircularProgress, Box } from "@mui/material";
import AutoUpdater from "./components/Electron/AutoUpdater";
import { ConnectionWizard } from "./components/Electron/ConnectionWizard";
import { PWAInstallPrompt } from "./components/PWA/PWAInstallPrompt";
import { hasServers } from "./utils/serverStorage";
import { isElectron } from "./utils/platform";
import { useState } from "react";

function App() {
  const location = useLocation();
  const token = localStorage.getItem("accessToken");

  // Check if running in Electron and needs server configuration
  const needsServerSetup = isElectron() && !hasServers();
  const [showWizard, setShowWizard] = useState(needsServerSetup);

  // Check if onboarding is needed - but only make the request if we're not already on the onboarding page
  const shouldCheckOnboarding = location.pathname !== "/onboarding";
  const { data: onboardingStatus, isLoading: isCheckingOnboarding } = useGetOnboardingStatusQuery(
    undefined,
    { skip: !shouldCheckOnboarding || showWizard }
  );

  // Show connection wizard for Electron if no servers configured
  if (showWizard) {
    return (
      <ThemeProvider>
        <CssBaseline />
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
        <OnboardingPage />
      </ThemeProvider>
    );
  }

  if (!token && !isPublicRoute) {
    return (
      <ThemeProvider>
        <CssBaseline />
        <LoginPage />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <CssBaseline />
      <AutoUpdater />
      <PWAInstallPrompt />
      <AvatarCacheProvider>
        <NotificationProvider>
          <RoomProvider>
            <UserProfileProvider>
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
                <Route path="profile/edit" element={<ProfileEditPage />} />
                <Route path="profile/:userId" element={<ProfilePage />} />
                <Route path="community/create" element={<CreateCommunityPage />} />
                <Route path="community/:communityId">
                  <Route index element={<CommunityPage />} />
                  <Route path="edit" element={<EditCommunityPage />} />
                  <Route path="channel/:channelId" element={<CommunityPage />} />
                </Route>
              </Route>
            </Routes>
            </UserProfileProvider>
          </RoomProvider>
        </NotificationProvider>
      </AvatarCacheProvider>
    </ThemeProvider>
  );
}

export default App;
