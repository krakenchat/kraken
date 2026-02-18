import React, { useState } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

interface SpoilerTextProps {
  children: React.ReactNode;
}

export const SpoilerText: React.FC<SpoilerTextProps> = ({ children }) => {
  const [revealed, setRevealed] = useState(false);
  const theme = useTheme();

  const handleReveal = () => setRevealed(true);

  const handleKeyDown: React.KeyboardEventHandler<HTMLSpanElement> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleReveal();
    }
  };

  return (
    <Box
      component="span"
      role="button"
      tabIndex={0}
      aria-pressed={revealed}
      onClick={handleReveal}
      onKeyDown={handleKeyDown}
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
