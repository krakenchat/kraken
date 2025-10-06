import React, { useState } from "react";
import { Box, styled } from "@mui/material";
import { AttachmentPreview } from "./AttachmentPreview";
import { ImageLightbox } from "./ImageLightbox";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";

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

// Helper component to manage media type detection for lightbox
const LightboxManager: React.FC<{
  fileId: string;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}> = ({ fileId, onClose, onNext, onPrevious, hasNext, hasPrevious }) => {
  const { blobUrl } = useAuthenticatedImage(fileId);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");

  React.useEffect(() => {
    if (!blobUrl) return;

    fetch(blobUrl)
      .then((response) => response.blob())
      .then((blob) => {
        if (blob.type.startsWith("video/")) {
          setMediaType("video");
        } else {
          setMediaType("image");
        }
      })
      .catch(() => {
        setMediaType("image");
      });
  }, [blobUrl]);

  if (!blobUrl) return null;

  return (
    <ImageLightbox
      blobUrl={blobUrl}
      mediaType={mediaType}
      onClose={onClose}
      onNext={onNext}
      onPrevious={onPrevious}
      hasNext={hasNext}
      hasPrevious={hasPrevious}
    />
  );
};

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const nextImage = () => {
    if (lightboxIndex !== null && lightboxIndex < attachments.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const previousImage = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  // Single attachment: show full width (up to max width)
  if (attachments.length === 1) {
    return (
      <>
        <SingleAttachmentContainer>
          <AttachmentPreview fileId={attachments[0]} onClick={() => openLightbox(0)} />
        </SingleAttachmentContainer>
        {lightboxIndex !== null && (
          <LightboxManager
            fileId={attachments[lightboxIndex]}
            onClose={closeLightbox}
          />
        )}
      </>
    );
  }

  // Multiple attachments: show in grid
  return (
    <>
      <AttachmentsGrid>
        {attachments.map((fileId, index) => (
          <AttachmentPreview
            key={fileId}
            fileId={fileId}
            onClick={() => openLightbox(index)}
          />
        ))}
      </AttachmentsGrid>
      {lightboxIndex !== null && (
        <LightboxManager
          fileId={attachments[lightboxIndex]}
          onClose={closeLightbox}
          onNext={nextImage}
          onPrevious={previousImage}
          hasNext={lightboxIndex < attachments.length - 1}
          hasPrevious={lightboxIndex > 0}
        />
      )}
    </>
  );
};
