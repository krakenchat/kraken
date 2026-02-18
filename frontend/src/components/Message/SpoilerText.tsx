import React, { useState } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

interface SpoilerTextProps {
  children: React.ReactNode;
}

export const SpoilerText: React.FC<SpoilerTextProps> = ({ children }) => {
  const [revealed, setRevealed] = useState(false);
  const theme = useTheme();

  return (
    <Box
      component="span"
      onClick={() => setRevealed(true)}
      sx={{
        backgroundColor: revealed
          ? theme.palette.action.hover
          : theme.palette.text.primary,
        color: revealed ? "inherit" : "transparent",
        borderRadius: "3px",
        padding: "0 4px",
        cursor: revealed ? "text" : "pointer",
        transition: "background-color 0.3s, color 0.3s",
        userSelect: revealed ? "text" : "none",
      }}
    >
      {children}
    </Box>
  );
};
