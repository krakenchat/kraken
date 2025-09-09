import React from "react";
import { Box } from "@mui/material";

interface UserStatusIndicatorProps {
  isOnline?: boolean;
  size?: number;
}

const UserStatusIndicator: React.FC<UserStatusIndicatorProps> = ({ 
  isOnline = false, 
  size = 12 
}) => {
  if (!isOnline) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: -2,
        right: -2,
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#43b581", // Discord-style green
        border: "2px solid",
        borderColor: "background.paper",
        zIndex: 1,
      }}
    />
  );
};

export default UserStatusIndicator;