import React from "react";
import { Box, Tooltip } from "@mui/material";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";

export type ReadStatus = "sent" | "delivered" | "read";

interface ReadStatusIndicatorProps {
  status: ReadStatus;
  /** Only shown in DMs for own messages */
  showForDm?: boolean;
}

/**
 * Discord-style read status indicator showing checkmarks for messages
 *
 * ✓ (gray) = sent/delivered
 * ✓✓ (gray) = delivered to recipient
 * ✓✓ (blue) = read by recipient
 *
 * Only displayed for the user's own messages in DMs
 */
export const ReadStatusIndicator: React.FC<ReadStatusIndicatorProps> = ({
  status,
  showForDm = true,
}) => {
  if (!showForDm) return null;

  const getIcon = () => {
    switch (status) {
      case "sent":
        return <DoneIcon sx={{ fontSize: 14 }} />;
      case "delivered":
        return <DoneAllIcon sx={{ fontSize: 14 }} />;
      case "read":
        return <DoneAllIcon sx={{ fontSize: 14, color: "primary.main" }} />;
      default:
        return null;
    }
  };

  const getTooltipText = () => {
    switch (status) {
      case "sent":
        return "Sent";
      case "delivered":
        return "Delivered";
      case "read":
        return "Read";
      default:
        return "";
    }
  };

  return (
    <Tooltip title={getTooltipText()} placement="top" arrow>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          color: status === "read" ? "primary.main" : "text.disabled",
          ml: 0.5,
        }}
      >
        {getIcon()}
      </Box>
    </Tooltip>
  );
};

export default ReadStatusIndicator;
