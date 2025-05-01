import React from "react";
import { Box, AppBar, Toolbar, Typography, Button } from "@mui/material";
import { Link, Outlet } from "react-router-dom";
import { useProfileQuery } from "./features/users/usersSlice";
import { useLazyLogoutQuery } from "./features/auth/authSlice";
import ThemeToggle from "./components/ThemeToggle/ThemeToggle";
import CommunityToggle from "./components/Community/CommunityToggle";

const APPBAR_HEIGHT = 64; // px, adjust if your AppBar is a different height
const SIDEBAR_WIDTH = 80; // px, matches CommunityToggle Drawer

const Layout: React.FC = () => {
  const { data, isLoading, isError } = useProfileQuery(undefined);
  const [logout, { isLoading: logoutLoading }] = useLazyLogoutQuery();

  const handleLogout = async () => {
    // Clear any authentication tokens or session data here
    await logout(null, false).unwrap();
    localStorage.removeItem("accessToken"); // Assuming you store the token in local storage
    window.location.href = "/login"; // Redirect to login after logout
  };

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          zIndex: 1201,
          width: "100vw",
          left: 0,
          top: 0,
          height: APPBAR_HEIGHT,
        }}
      >
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
            <Typography variant="h6">Kraken</Typography>
            <ThemeToggle />
          </div>
          <Link
            to="/"
            style={{ color: "white", textDecoration: "none", marginRight: 16 }}
          >
            Home
          </Link>
          {isLoading ? (
            <Typography
              variant="body2"
              sx={{ color: "white", marginRight: 16 }}
            >
              Loading...
            </Typography>
          ) : isError || !data ? (
            <>
              <Link
                to="/login"
                style={{
                  color: "white",
                  textDecoration: "none",
                  marginRight: 16,
                }}
              >
                Login
              </Link>
              <Link to="/register" style={{ textDecoration: "none" }}>
                Register
              </Link>
            </>
          ) : (
            <Button
              onClick={handleLogout}
              disabled={logoutLoading}
              sx={{ color: "white", textTransform: "none" }}
            >
              Logout
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <CommunityToggle appBarHeight={APPBAR_HEIGHT} />
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
        <Box sx={{ p: 2, boxShadow: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </>
  );
};

export default Layout;
