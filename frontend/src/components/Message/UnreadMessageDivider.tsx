import React from "react";
import { Box, Typography, Divider } from "@mui/material";

interface UnreadMessageDividerProps {
  unreadCount?: number;
}

/**
 * Divider component that shows "NEW MESSAGES" between read and unread messages
 * Similar to Discord's unread message indicator
 */
export const UnreadMessageDivider: React.FC<UnreadMessageDividerProps> = ({
  unreadCount,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        my: 2,
        gap: 1,
      }}
    >
      <Divider
        sx={{
          flex: 1,
          borderColor: "error.main",
          borderWidth: 1,
        }}
      />
      <Typography
        variant="caption"
        sx={{
          color: "error.main",
          fontWeight: 600,
          fontSize: "0.75rem",
          letterSpacing: "0.5px",
          whiteSpace: "nowrap",
        }}
      >
        {unreadCount !== undefined && unreadCount > 0
          ? `${unreadCount} NEW MESSAGE${unreadCount > 1 ? "S" : ""}`
          : "NEW MESSAGES"}
      </Typography>
      <Divider
        sx={{
          flex: 1,
          borderColor: "error.main",
          borderWidth: 1,
        }}
      />
    </Box>
  );
};
