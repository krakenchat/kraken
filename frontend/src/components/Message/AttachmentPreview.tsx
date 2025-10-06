import React from "react";
import { Box, Card, CardMedia, CircularProgress, Alert, styled } from "@mui/material";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";

const AttachmentCard = styled(Card)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 200,
  backgroundColor: theme.palette.action.hover,
}));

const StyledImage = styled("img")({
  width: "100%",
  maxHeight: 400,
  objectFit: "contain",
  display: "block",
});

interface AttachmentPreviewProps {
  fileId: string;
  alt?: string;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  fileId,
  alt = "Attachment",
}) => {
  const { blobUrl, isLoading, error } = useAuthenticatedImage(fileId);

  if (error) {
    return (
      <AttachmentCard>
        <Alert severity="error" sx={{ m: 1 }}>
          Failed to load attachment
        </Alert>
      </AttachmentCard>
    );
  }

  if (isLoading || !blobUrl) {
    return (
      <AttachmentCard>
        <LoadingContainer>
          <CircularProgress size={32} />
        </LoadingContainer>
      </AttachmentCard>
    );
  }

  return (
    <AttachmentCard>
      <StyledImage src={blobUrl} alt={alt} />
    </AttachmentCard>
  );
};
