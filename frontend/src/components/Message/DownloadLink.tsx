import React from "react";
import { Box, Card, Typography, IconButton, CircularProgress, Alert } from "@mui/material";
import { styled } from "@mui/material/styles";
import DownloadIcon from "@mui/icons-material/Download";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import CodeIcon from "@mui/icons-material/Code";
import ArchiveIcon from "@mui/icons-material/Archive";
import { useAuthenticatedFile } from "../../hooks/useAuthenticatedFile";

const DownloadCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1),
  maxWidth: 400,
  cursor: "pointer",
  transition: "background-color 0.2s",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

const FileIcon = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 48,
  height: 48,
  borderRadius: theme.spacing(0.5),
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
}));

const FileInfo = styled(Box)({
  flex: 1,
  minWidth: 0, // Allow text overflow
});

interface DownloadLinkProps {
  fileId: string;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes("pdf")) {
    return <PictureAsPdfIcon fontSize="large" />;
  } else if (mimeType.includes("text") || mimeType.includes("document")) {
    return <DescriptionIcon fontSize="large" />;
  } else if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed")) {
    return <ArchiveIcon fontSize="large" />;
  } else if (mimeType.includes("code") || mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("xml")) {
    return <CodeIcon fontSize="large" />;
  }
  return <InsertDriveFileIcon fontSize="large" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export const DownloadLink: React.FC<DownloadLinkProps> = ({ fileId }) => {
  const { blobUrl, metadata, isLoading, error } = useAuthenticatedFile(fileId, {
    fetchBlob: true,
    fetchMetadata: true,
  });

  const handleDownload = () => {
    if (!blobUrl || !metadata) return;

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = metadata.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <DownloadCard>
        <Alert severity="error" sx={{ width: "100%" }}>
          Failed to load file
        </Alert>
      </DownloadCard>
    );
  }

  if (isLoading || !metadata) {
    return (
      <DownloadCard>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          Loading file...
        </Typography>
      </DownloadCard>
    );
  }

  return (
    <DownloadCard onClick={handleDownload}>
      <FileIcon>{getFileIcon(metadata.mimeType)}</FileIcon>
      <FileInfo>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {metadata.filename}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatFileSize(metadata.size)}
        </Typography>
      </FileInfo>
      <IconButton
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
        disabled={!blobUrl}
        color="primary"
        aria-label="download file"
      >
        <DownloadIcon />
      </IconButton>
    </DownloadCard>
  );
};
