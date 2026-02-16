import React from "react";
import { Box, Tooltip } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";

export type ReadStatus = "sent" | "delivered" | "read";

interface ReadStatusIndicatorProps {
  status: ReadStatus;
  /** Only shown in DMs for own messages */
  showForDm?: boolean;
  /** Disable the built-in tooltip (when wrapped by an outer tooltip) */
  disableTooltip?: boolean;
}

/**
 * Read status indicator for DM messages:
 * - grey eye icon = not yet seen
 * - blue eye icon = seen by recipient(s)
 *
 * Only displayed for the user's own messages in DMs.
 */
export const ReadStatusIndicator: React.FC<ReadStatusIndicatorProps> = ({
  status,
  showForDm = true,
  disableTooltip = false,
}) => {
  if (!showForDm) return null;

  const isSeen = status === "read" || status === "delivered";
  const color = isSeen ? "primary.main" : "text.secondary";
  const tooltipText = isSeen ? "Seen" : "Sent";

  const content = (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        color,
        ml: 0.5,
      }}
    >
      <VisibilityIcon sx={{ fontSize: 14, color }} />
    </Box>
  );

  if (disableTooltip) {
    return content;
  }

  return (
    <Tooltip title={tooltipText} placement="top" arrow>
      {content}
    </Tooltip>
  );
};

export default ReadStatusIndicator;
