import React from "react";
import { Box, AppBar, Toolbar, Typography, Button } from "@mui/material";
import { Link, Outlet } from "react-router-dom";
import { useProfileQuery } from "./features/users/usersSlice";
import { useLazyLogoutQuery } from "./features/auth/authSlice";

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
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppBar position="sticky" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Kraken
          </Typography>
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
              <Link
                to="/register"
                style={{ color: "white", textDecoration: "none" }}
              >
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
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          backgroundColor: "#f5f5f5",
        }}
      >
        <Box
          sx={{
            padding: 2,
            backgroundColor: "white",
            boxShadow: 3,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
