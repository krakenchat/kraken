import React from "react";
import { Box } from "@mui/material";
import { LinkPreviewCard } from "./LinkPreviewCard";
import type { LinkPreview } from "../../types/message.type";

interface MessageLinkPreviewsProps {
  linkPreviews?: LinkPreview[];
}

export const MessageLinkPreviews: React.FC<MessageLinkPreviewsProps> =
  React.memo(({ linkPreviews }) => {
    if (!linkPreviews || linkPreviews.length === 0) return null;

    return (
      <Box sx={{ mt: 0.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
        {linkPreviews.map((preview) => (
          <LinkPreviewCard key={preview.url} preview={preview} />
        ))}
      </Box>
    );
  });

MessageLinkPreviews.displayName = "MessageLinkPreviews";
