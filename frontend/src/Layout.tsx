import React from "react";
import { Box, AppBar, Toolbar, Typography, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Outlet } from "react-router-dom";
import { useProfileQuery } from "./features/users/usersSlice";
import { useLazyLogoutQuery } from "./features/auth/authSlice";
import ThemeToggle from "./components/ThemeToggle/ThemeToggle";
import CommunityToggle from "./components/CommunityList/CommunityToggle";
import NavigationLinks from "./components/NavBar/NavigationLinks";
import ProfileIcon from "./components/NavBar/ProfileIcon";
import { VoiceBottomBar } from "./components/Voice";
import type { User } from "./types/auth.type";

const APPBAR_HEIGHT = 64;
const SIDEBAR_WIDTH = 80;
const settings = ["Profile", "Account", "Dashboard", "Logout"];

const Layout: React.FC = () => {
  const { data: userData, isLoading, isError } = useProfileQuery(undefined);
  const [logout, { isLoading: logoutLoading }] = useLazyLogoutQuery();
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

  const handleLogout = async () => {
    await logout(null, false).unwrap();
    localStorage.removeItem("accessToken");
    window.location.href = "/login";
  };

  // Fix userData type for ProfileIcon
  const profileUserData = userData
    ? {
        displayName: userData.displayName ?? undefined,
        avatarUrl: userData.avatarUrl ?? undefined,
      }
    : undefined;

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
          bottom: 0,
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
