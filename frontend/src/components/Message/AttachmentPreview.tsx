import React, { useState, useEffect } from "react";
import { Box, Card, CircularProgress, Alert, styled } from "@mui/material";
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
  cursor: "pointer",
  transition: "opacity 0.2s",
  "&:hover": {
    opacity: 0.9,
  },
});

const StyledVideo = styled("video")({
  width: "100%",
  maxHeight: 400,
  objectFit: "contain",
  display: "block",
  cursor: "pointer",
});

interface AttachmentPreviewProps {
  fileId: string;
  alt?: string;
  onClick?: () => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  fileId,
  alt = "Attachment",
  onClick,
}) => {
  const { blobUrl, isLoading, error } = useAuthenticatedImage(fileId);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);

  // Detect media type from blob URL
  useEffect(() => {
    if (!blobUrl) {
      setMediaType(null);
      return;
    }

    // Fetch the blob to check its MIME type
    fetch(blobUrl)
      .then((response) => response.blob())
      .then((blob) => {
        if (blob.type.startsWith("video/")) {
          setMediaType("video");
        } else if (blob.type.startsWith("image/")) {
          setMediaType("image");
        } else {
          // Default to image for now
          setMediaType("image");
        }
      })
      .catch(() => {
        setMediaType("image"); // Fallback to image
      });
  }, [blobUrl]);

  if (error) {
    return (
      <AttachmentCard>
        <Alert severity="error" sx={{ m: 1 }}>
          Failed to load attachment
        </Alert>
      </AttachmentCard>
    );
  }

  if (isLoading || !blobUrl || !mediaType) {
    return (
      <AttachmentCard>
        <LoadingContainer>
          <CircularProgress size={32} />
        </LoadingContainer>
      </AttachmentCard>
    );
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <AttachmentCard>
      {mediaType === "video" ? (
        <StyledVideo src={blobUrl} controls onClick={handleClick}>
          Your browser does not support the video tag.
        </StyledVideo>
      ) : (
        <StyledImage src={blobUrl} alt={alt} onClick={handleClick} />
      )}
    </AttachmentCard>
  );
};
