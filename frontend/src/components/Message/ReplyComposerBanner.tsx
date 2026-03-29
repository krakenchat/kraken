/**
 * ReplyComposerBanner Component
 *
 * Banner shown above the message input when replying to / quoting a message.
 * Shows "Replying to @username" with a cancel button.
 */

import React from "react";
import { Box, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useQuery } from "@tanstack/react-query";
import { userControllerGetUserByIdOptions } from "../../api-client/@tanstack/react-query.gen";
import type { Message } from "../../types/message.type";

interface ReplyComposerBannerProps {
  replyToMessage: Message;
  onCancel: () => void;
}

const ReplyComposerBanner: React.FC<ReplyComposerBannerProps> = ({
  replyToMessage,
  onCancel,
}) => {
  const { data: author } = useQuery({
    ...userControllerGetUserByIdOptions({ path: { id: replyToMessage.authorId! } }),
    enabled: !!replyToMessage.authorId,
  });

  const authorName = author?.displayName || author?.username || "Unknown";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        py: 0.5,
        borderLeft: "2px solid",
        borderColor: "primary.main",
        backgroundColor: "action.hover",
        borderRadius: 1,
        mx: 1,
        mb: 0.5,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Replying to{" "}
        <Typography
          component="span"
          variant="caption"
          sx={{ fontWeight: 600, color: "primary.main" }}
        >
          {authorName}
        </Typography>
      </Typography>
      <IconButton size="small" onClick={onCancel} aria-label="cancel reply">
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};

export default React.memo(ReplyComposerBanner);
