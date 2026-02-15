import React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useSocketConnected } from "../hooks/useSocket";

export const ConnectionStatusBanner: React.FC = () => {
  const isConnected = useSocketConnected();

  if (isConnected) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        bgcolor: "warning.main",
        color: "warning.contrastText",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 0.5,
        gap: 1,
      }}
    >
      <CircularProgress size={14} color="inherit" />
      <Typography variant="caption">Reconnecting...</Typography>
    </Box>
  );
};
