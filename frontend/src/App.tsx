import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import RegisterPage from "./pages/RegisterPage";
import CreateCommunityPage from "./pages/CreateCommunityPage";
import EditCommunityPage from "./pages/EditCommunityPage";
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
  const token = localStorage.getItem("accessToken");
  if (!token) {
    return <LoginPage />;
  }
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <RoomProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
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
