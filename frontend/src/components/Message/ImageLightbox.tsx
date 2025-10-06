import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Box, IconButton, styled } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

const LightboxOverlay = styled(Box)({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.9)",
  backdropFilter: "blur(10px)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "zoom-out",
});

const LightboxContent = styled(Box)({
  position: "relative",
  maxWidth: "90vw",
  maxHeight: "90vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "default",
});

const LightboxImage = styled("img")({
  maxWidth: "100%",
  maxHeight: "90vh",
  objectFit: "contain",
  userSelect: "none",
});

const LightboxVideo = styled("video")({
  maxWidth: "100%",
  maxHeight: "90vh",
  objectFit: "contain",
});

const CloseButton = styled(IconButton)(({ theme }) => ({
  position: "fixed",
  top: theme.spacing(3),
  right: theme.spacing(3),
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  color: "white",
  zIndex: 10001,
  "&:hover": {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
}));

const NavigationButton = styled(IconButton)(({ theme }) => ({
  position: "fixed",
  top: "50%",
  transform: "translateY(-50%)",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  color: "white",
  zIndex: 10001,
  "&:hover": {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  "&:disabled": {
    display: "none",
  },
}));

interface ImageLightboxProps {
  blobUrl: string;
  mediaType: "image" | "video";
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  blobUrl,
  mediaType,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" && hasNext && onNext) {
        onNext();
      } else if (e.key === "ArrowLeft" && hasPrevious && onPrevious) {
        onPrevious();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [onClose, onNext, onPrevious, hasNext, hasPrevious]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Only close if clicking the overlay itself, not the content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const lightboxContent = (
    <LightboxOverlay onClick={handleOverlayClick}>
      <CloseButton onClick={onClose} size="large">
        <CloseIcon />
      </CloseButton>

      {hasPrevious && onPrevious && (
        <NavigationButton
          onClick={onPrevious}
          sx={{ left: (theme) => theme.spacing(2) }}
          size="large"
        >
          <ArrowBackIosNewIcon />
        </NavigationButton>
      )}

      {hasNext && onNext && (
        <NavigationButton
          onClick={onNext}
          sx={{ right: (theme) => theme.spacing(2) }}
          size="large"
        >
          <ArrowForwardIosIcon />
        </NavigationButton>
      )}

      <LightboxContent onClick={(e) => e.stopPropagation()}>
        {mediaType === "video" ? (
          <LightboxVideo src={blobUrl} controls autoPlay>
            Your browser does not support the video tag.
          </LightboxVideo>
        ) : (
          <LightboxImage src={blobUrl} alt="Fullscreen preview" />
        )}
      </LightboxContent>
    </LightboxOverlay>
  );

  // Render using portal to document.body to escape parent constraints
  return createPortal(lightboxContent, document.body);
};
