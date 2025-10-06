import React, { useState, useEffect } from "react";
import { Box, Card, CircularProgress, Alert, styled } from "@mui/material";
import { useAuthenticatedFile } from "../../hooks/useAuthenticatedFile";
import { AudioPlayer } from "./AudioPlayer";
import { DownloadLink } from "./DownloadLink";

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
  const { blobUrl, metadata, isLoading, error } = useAuthenticatedFile(fileId, {
    fetchBlob: true,
    fetchMetadata: true,
  });
  const [mediaType, setMediaType] = useState<"image" | "video" | "audio" | "other" | null>(null);

  // Detect media type from metadata
  useEffect(() => {
    if (!metadata) {
      setMediaType(null);
      return;
    }

    const mimeType = metadata.mimeType.toLowerCase();

    if (mimeType.startsWith("image/")) {
      setMediaType("image");
    } else if (mimeType.startsWith("video/")) {
      setMediaType("video");
    } else if (mimeType.startsWith("audio/")) {
      setMediaType("audio");
    } else {
      setMediaType("other");
    }
  }, [metadata]);

  if (error) {
    return (
      <AttachmentCard>
        <Alert severity="error" sx={{ m: 1 }}>
          Failed to load attachment
        </Alert>
      </AttachmentCard>
    );
  }

  if (isLoading || !blobUrl || !mediaType || !metadata) {
    return (
      <AttachmentCard>
        <LoadingContainer>
          <CircularProgress size={32} />
        </LoadingContainer>
      </AttachmentCard>
    );
  }

  // Audio files get their own specialized player
  if (mediaType === "audio") {
    return <AudioPlayer fileId={fileId} />;
  }

  // Other file types get a download link
  if (mediaType === "other") {
    return <DownloadLink fileId={fileId} />;
  }

  // Images and videos are displayed inline
  return (
    <AttachmentCard>
      {mediaType === "video" ? (
        <StyledVideo src={blobUrl} controls>
          Your browser does not support the video tag.
        </StyledVideo>
      ) : (
        <StyledImage src={blobUrl} alt={alt} onClick={onClick} />
      )}
    </AttachmentCard>
  );
};
