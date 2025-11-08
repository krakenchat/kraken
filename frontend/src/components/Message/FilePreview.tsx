/**
 * FilePreview Component
 *
 * Displays file attachments with previews for images and chips for other file types.
 * Used by MessageInput components to show selected files before sending.
 */

import React from "react";
import { Box, IconButton, Chip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export interface FilePreviewProps {
  files: File[];
  previews: Map<number, string>;
  onRemoveFile: (index: number) => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  files,
  previews,
  onRemoveFile,
}) => {
  if (files.length === 0) return null;

  return (
    <Box sx={{ mb: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
      {files.map((file, index) => {
        const preview = previews.get(index);
        const isImage = file.type.startsWith('image/');

        if (isImage && preview) {
          return (
            <Box
              key={index}
              sx={{
                position: 'relative',
                width: 80,
                height: 80,
                borderRadius: 1,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <img
                src={preview}
                alt={file.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <IconButton
                onClick={() => onRemoveFile(index)}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  },
                  width: 20,
                  height: 20,
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          );
        }

        return (
          <Chip
            key={index}
            label={file.name}
            onDelete={() => onRemoveFile(index)}
            deleteIcon={<CloseIcon />}
            size="small"
          />
        );
      })}
    </Box>
  );
};
