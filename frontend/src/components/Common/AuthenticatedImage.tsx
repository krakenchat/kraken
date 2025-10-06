import React from "react";
import { Box, CircularProgress, Avatar, SxProps, Theme } from "@mui/material";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";

interface AuthenticatedImageProps {
  fileId: string | null | undefined;
  alt: string;
  fallback?: React.ReactNode;
  component?: "img" | "avatar";
  sx?: SxProps<Theme>;
  className?: string;
}

/**
 * Component that fetches an image with authentication and displays it
 * Handles loading states and errors gracefully
 */
export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  fileId,
  alt,
  fallback,
  component = "img",
  sx,
  className,
}) => {
  const { blobUrl, isLoading, error } = useAuthenticatedImage(fileId);

  // Show loading state
  if (isLoading && !blobUrl) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...sx,
        }}
        className={className}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Show fallback on error or no fileId
  if (error || !fileId || !blobUrl) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (component === "avatar") {
      return <Avatar sx={sx} className={className}>{alt.slice(0, 2).toUpperCase()}</Avatar>;
    }

    return null;
  }

  // Render the image
  if (component === "avatar") {
    return <Avatar src={blobUrl} alt={alt} sx={sx} className={className} />;
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      style={sx as React.CSSProperties}
      className={className}
    />
  );
};
