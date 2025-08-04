import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./Layout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import RegisterPage from "./pages/RegisterPage";
import CreateCommunityPage from "./pages/CreateCommunityPage";
import EditCommunityPage from "./pages/EditCommunityPage";
import JoinInvitePage from "./pages/JoinInvitePage";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import CommunityPage from "./pages/CommunityPage";
import { RoomProvider } from "./contexts/RoomContext";

const darkTheme = createTheme({
  colorSchemes: {
    dark: true,
    light: true,
  },
});

function App() {
  const location = useLocation();
  const token = localStorage.getItem("accessToken");
  
  // Allow access to certain routes without authentication
  const publicRoutes = ["/login", "/register", "/join"];
  const isPublicRoute = publicRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(route + "/")
  );
  
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
      <RoomProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/join/:inviteCode" element={<JoinInvitePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Authenticated routes */}
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="community/create" element={<CreateCommunityPage />} />
            <Route path="community/:communityId">
              <Route index element={<CommunityPage />} />
              <Route path="edit" element={<EditCommunityPage />} />
              <Route path="channel/:channelId" element={<CommunityPage />} />
            </Route>
          </Route>
        </Routes>
      </RoomProvider>
    </ThemeProvider>
  );
}

export default App;
