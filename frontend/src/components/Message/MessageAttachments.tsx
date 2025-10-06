import React, { useState } from "react";
import { Box, styled } from "@mui/material";
import { AttachmentPreview } from "./AttachmentPreview";
import { ImageLightbox } from "./ImageLightbox";
import { useAuthenticatedFile } from "../../hooks/useAuthenticatedFile";

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

// Helper component to determine if attachment is an image
const AttachmentWithMetadata: React.FC<{
  fileId: string;
  onImageClick?: () => void;
}> = ({ fileId, onImageClick }) => {
  const { metadata } = useAuthenticatedFile(fileId, {
    fetchBlob: false,
    fetchMetadata: true,
  });

  const isImage = metadata?.mimeType?.startsWith("image/");

  return (
    <AttachmentPreview
      fileId={fileId}
      onClick={isImage ? onImageClick : undefined}
    />
  );
};

// Helper component to manage lightbox for images only
const ImageLightboxManager: React.FC<{
  fileId: string;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}> = ({ fileId, onClose, onNext, onPrevious, hasNext, hasPrevious }) => {
  const { blobUrl } = useAuthenticatedFile(fileId, {
    fetchBlob: true,
    fetchMetadata: false,
  });

  if (!blobUrl) return null;

  return (
    <ImageLightbox
      blobUrl={blobUrl}
      mediaType="image"
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
  const [imageFileIds, setImageFileIds] = React.useState<string[]>([]);

  // Track which attachments are images for lightbox navigation
  React.useEffect(() => {
    const checkImages = async () => {
      const imageIds: string[] = [];

      for (const fileId of attachments) {
        try {
          const token = localStorage.getItem("accessToken");
          const response = await fetch(`/api/file/${fileId}/metadata`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const metadata = await response.json();
            if (metadata.mimeType?.startsWith("image/")) {
              imageIds.push(fileId);
            }
          }
        } catch (error) {
          console.error("Error checking file type:", error);
        }
      }

      setImageFileIds(imageIds);
    };

    checkImages();
  }, [attachments]);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const openLightbox = (fileId: string) => {
    const imageIndex = imageFileIds.indexOf(fileId);
    if (imageIndex !== -1) {
      setLightboxIndex(imageIndex);
    }
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const nextImage = () => {
    if (lightboxIndex !== null && lightboxIndex < imageFileIds.length - 1) {
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
          <AttachmentWithMetadata
            fileId={attachments[0]}
            onImageClick={() => openLightbox(attachments[0])}
          />
        </SingleAttachmentContainer>
        {lightboxIndex !== null && imageFileIds[lightboxIndex] && (
          <ImageLightboxManager
            fileId={imageFileIds[lightboxIndex]}
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
        {attachments.map((fileId) => (
          <AttachmentWithMetadata
            key={fileId}
            fileId={fileId}
            onImageClick={() => openLightbox(fileId)}
          />
        ))}
      </AttachmentsGrid>
      {lightboxIndex !== null && imageFileIds[lightboxIndex] && (
        <ImageLightboxManager
          fileId={imageFileIds[lightboxIndex]}
          onClose={closeLightbox}
          onNext={nextImage}
          onPrevious={previousImage}
          hasNext={lightboxIndex < imageFileIds.length - 1}
          hasPrevious={lightboxIndex > 0}
        />
      )}
    </>
  );
};
