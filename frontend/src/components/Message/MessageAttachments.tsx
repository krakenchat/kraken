import React from "react";
import { Box, styled } from "@mui/material";
import { AttachmentPreview } from "./AttachmentPreview";

const AttachmentsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
  maxWidth: "100%",
}));

const SingleAttachmentContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
  maxWidth: 500,
}));

interface MessageAttachmentsProps {
  attachments: string[];
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
}) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  // Single attachment: show full width (up to max width)
  if (attachments.length === 1) {
    return (
      <SingleAttachmentContainer>
        <AttachmentPreview fileId={attachments[0]} />
      </SingleAttachmentContainer>
    );
  }

  // Multiple attachments: show in grid
  return (
    <AttachmentsGrid>
      {attachments.map((fileId) => (
        <AttachmentPreview key={fileId} fileId={fileId} />
      ))}
    </AttachmentsGrid>
  );
};
