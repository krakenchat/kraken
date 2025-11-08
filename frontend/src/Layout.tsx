import React from "react";
import { Box, AppBar, Toolbar, Typography, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Outlet, useNavigate } from "react-router-dom";
import { useProfileQuery } from "./features/users/usersSlice";
import { useLazyLogoutQuery } from "./features/auth/authSlice";
import ThemeToggle from "./components/ThemeToggle/ThemeToggle";
import CommunityToggle from "./components/CommunityList/CommunityToggle";
import NavigationLinks from "./components/NavBar/NavigationLinks";
import ProfileIcon from "./components/NavBar/ProfileIcon";
import { VoiceBottomBar } from "./components/Voice";
import { useVoiceConnection } from "./hooks/useVoiceConnection";
import { usePresenceHeartbeat } from "./hooks/usePresenceHeartbeat";
import { usePresenceEvents } from "./hooks/usePresenceEvents";
import { useVoiceEvents } from "./hooks/useVoiceEvents";
import { MobileLayout } from "./components/Mobile/MobileLayout";
import { useResponsive } from "./hooks/useResponsive";
import { isElectron } from "./utils/platform";
import type { User } from "./types/auth.type";
import { APPBAR_HEIGHT, SIDEBAR_WIDTH, VOICE_BAR_HEIGHT } from "./constants/layout";

const settings = isElectron()
  ? ["Edit Profile", "Settings", "Logout"]
  : ["Edit Profile", "Logout"];

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { data: userData, isLoading, isError } = useProfileQuery(undefined);
  const [logout, { isLoading: logoutLoading }] = useLazyLogoutQuery();
  const { state: voiceState } = useVoiceConnection();
  const { isMobile } = useResponsive();

  // Send presence heartbeat to keep user marked as online
  usePresenceHeartbeat(userData !== undefined && !isLoading && !isError);

  // Listen for real-time presence events
  usePresenceEvents();

  // Listen for real-time voice presence events globally
  useVoiceEvents();
  const [isMenuExpanded, setIsMenuExpanded] = React.useState(false);
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(
    null
  );

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleSettingClick = (setting: string) => {
    if (setting === "Edit Profile") {
      navigate("/profile/edit");
    } else if (setting === "Settings") {
      navigate("/settings");
    } else if (setting === "Logout") {
      handleLogout();
    }
  };

  const handleLogout = async () => {
    await logout(null, false).unwrap();
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  // Fix userData type for ProfileIcon
  const profileUserData = userData
    ? {
        displayName: userData.displayName ?? undefined,
        avatarUrl: userData.avatarUrl ?? undefined,
      }
    : undefined;

  // Use mobile layout on small screens
  if (isMobile) {
    return <MobileLayout />;
  }

  // Desktop layout (original)
  return (
    <>
      <AppBar position="fixed">
        <Toolbar sx={{ minHeight: APPBAR_HEIGHT }}>
          <div
            style={{
              flexGrow: 1,
              flexDirection: "row",
              display: "flex",
              alignItems: "center",
              gap: "0.25em",
            }}
          >
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={() => setIsMenuExpanded(!isMenuExpanded)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6">Kraken</Typography>
          </div>
          <NavigationLinks
            isLoading={isLoading}
            isError={isError}
            userData={userData as User | undefined}
            handleLogout={handleLogout}
            logoutLoading={logoutLoading}
          />
          <ThemeToggle />
          &nbsp;
          {!isLoading && (
            <ProfileIcon
              userData={profileUserData}
              anchorElUser={anchorElUser}
              handleOpenUserMenu={handleOpenUserMenu}
              handleCloseUserMenu={handleCloseUserMenu}
              settings={settings}
              onSettingClick={handleSettingClick}
            />
          )}
        </Toolbar>
      </AppBar>
      <CommunityToggle
        isExpanded={isMenuExpanded}
        appBarHeight={APPBAR_HEIGHT}
      />
      <Box
        sx={{
          position: "absolute",
          top: APPBAR_HEIGHT,
          left: SIDEBAR_WIDTH,
          right: 0,
          bottom: voiceState.isConnected ? VOICE_BAR_HEIGHT : 0,
          overflow: "auto",
        }}
      >
        <Box>
          <Outlet />
        </Box>
      </Box>

      {/* Voice Components */}
      <VoiceBottomBar />
    </>
  );
};

export default Layout;
