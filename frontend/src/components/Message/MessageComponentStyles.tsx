/**
 * MessageComponentStyles
 *
 * Styled components for MessageComponent.
 * Provides container styling with hover effects, delete animations, and mention highlighting.
 */

import { styled, keyframes } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";

// Flash animation for search highlight
const searchHighlightFlash = keyframes`
  0% {
    background-color: transparent;
  }
  15% {
    background-color: rgba(255, 235, 59, 0.4);
  }
  30% {
    background-color: rgba(255, 235, 59, 0.2);
  }
  45% {
    background-color: rgba(255, 235, 59, 0.35);
  }
  60% {
    background-color: rgba(255, 235, 59, 0.15);
  }
  100% {
    background-color: transparent;
  }
`;

export const Container = styled("div", {
  shouldForwardProp: (prop) =>
    prop !== "stagedForDelete" &&
    prop !== "isDeleting" &&
    prop !== "isHighlighted" &&
    prop !== "isSearchHighlight",
})<{
  stagedForDelete?: boolean;
  isDeleting?: boolean;
  isHighlighted?: boolean;
  isSearchHighlight?: boolean;
}>(({ theme, stagedForDelete, isDeleting, isHighlighted, isSearchHighlight }) => ({
  padding: theme.spacing(0.5, 2),
  display: "flex",
  alignItems: "flex-start",
  width: "100%",
  marginBottom: isDeleting ? 0 : theme.spacing(1),
  position: "relative",
  backgroundColor: isHighlighted
    ? alpha(theme.palette.primary.main, 0.08)
    : "transparent",
  border: stagedForDelete
    ? `2px solid ${theme.palette.error.main}`
    : isHighlighted
    ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
    : "2px solid transparent",
  borderRadius: stagedForDelete || isSearchHighlight ? theme.spacing(1) : 0,
  transition: isDeleting ? "all 0.3s ease-out" : "all 0.2s ease-in-out",
  opacity: isDeleting ? 0 : 1,
  transform: isDeleting
    ? "translateY(-10px) scale(0.98)"
    : "translateY(0) scale(1)",
  maxHeight: isDeleting ? 0 : "none",
  overflow: isDeleting ? "hidden" : "visible",
  paddingTop: isDeleting ? 0 : theme.spacing(0.5),
  paddingBottom: isDeleting ? 0 : theme.spacing(0.5),
  // Search highlight flash animation
  animation: isSearchHighlight ? `${searchHighlightFlash} 2.5s ease-in-out` : "none",
  "&:hover": {
    backgroundColor: stagedForDelete
      ? theme.palette.error.light
      : isHighlighted
      ? alpha(theme.palette.primary.main, 0.12)
      : theme.palette.action.hover,
    "& .message-tools": {
      opacity: 1,
    },
  },
}));
