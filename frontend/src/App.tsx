import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./Layout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import RegisterPage from "./pages/RegisterPage";
import CreateCommunityPage from "./pages/CreateCommunityPage";
import EditCommunityPage from "./pages/EditCommunityPage";
import JoinInvitePage from "./pages/JoinInvitePage";
import AdminInvitePage from "./pages/AdminInvitePage";
import OnboardingPage from "./pages/OnboardingPage";
import DirectMessagesPage from "./pages/DirectMessagesPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileEditPage from "./pages/ProfileEditPage";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import CommunityPage from "./pages/CommunityPage";
import { RoomProvider } from "./contexts/RoomContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { useGetOnboardingStatusQuery } from "./features/onboarding/onboardingApiSlice";
import { CircularProgress, Box } from "@mui/material";

const darkTheme = createTheme({
  colorSchemes: {
    dark: true,
    light: true,
  },
});

function App() {
  const location = useLocation();
  const token = localStorage.getItem("accessToken");
  
  // Check if onboarding is needed - but only make the request if we're not already on the onboarding page
  const shouldCheckOnboarding = location.pathname !== "/onboarding";
  const { data: onboardingStatus, isLoading: isCheckingOnboarding } = useGetOnboardingStatusQuery(
    undefined,
    { skip: !shouldCheckOnboarding }
  );
  
  // Allow access to certain routes without authentication
  const publicRoutes = ["/login", "/register", "/join", "/onboarding"];
  const isPublicRoute = publicRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(route + "/")
  );
  
  // Show loading spinner while checking onboarding status
  if (shouldCheckOnboarding && isCheckingOnboarding) {
    return (
      <ThemeProvider theme={darkTheme}>
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
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <OnboardingPage />
      </ThemeProvider>
    );
  }
  
  if (!token && !isPublicRoute) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <LoginPage />
      </ThemeProvider>
    );
  }
  
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <NotificationProvider>
        <RoomProvider>
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
              <Route path="admin/invites" element={<AdminInvitePage />} />
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
        </RoomProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
