/**
 * MessageToolbar Component
 *
 * Floating toolbar for message actions (edit, delete, react).
 * Shows on hover with confirmation UI for destructive actions.
 */

import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CancelIcon from "@mui/icons-material/Cancel";
import { styled } from "@mui/material/styles";
import { EmojiPicker } from "./EmojiPicker";

const MessageTools = styled(Box, {
  shouldForwardProp: (prop) => prop !== "stagedForDelete",
})<{ stagedForDelete?: boolean }>(({ theme, stagedForDelete }) => ({
  alignItems: "center",
  position: "absolute",
  right: theme.spacing(1),
  top: theme.spacing(0.5),
  opacity: stagedForDelete ? 1 : 0,
  transition: "opacity 0.2s ease-in-out",
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(0.5),
  boxShadow: theme.shadows[2],
  display: "flex",
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.25),
  border: stagedForDelete ? `1px solid ${theme.palette.error.main}` : "none",
}));

export interface MessageToolbarProps {
  canEdit: boolean;
  canDelete: boolean;
  stagedForDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onEmojiSelect: (emoji: string) => void;
}

export const MessageToolbar: React.FC<MessageToolbarProps> = ({
  canEdit,
  canDelete,
  stagedForDelete,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onEmojiSelect,
}) => {
  return (
    <MessageTools
      className="message-tools"
      stagedForDelete={stagedForDelete}
    >
      {stagedForDelete ? (
        <>
          <Typography
            variant="caption"
            sx={{
              px: 1,
              color: "error.main",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
            }}
          >
            Delete?
          </Typography>
          <IconButton
            size="small"
            onClick={onConfirmDelete}
            color="error"
          >
            <CheckIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onCancelDelete}>
            <CancelIcon fontSize="small" />
          </IconButton>
        </>
      ) : (
        <>
          <EmojiPicker onEmojiSelect={onEmojiSelect} />
          {canEdit && (
            <IconButton size="small" onClick={onEdit}>
              <EditIcon fontSize="small" />
            </IconButton>
          )}
          {canDelete && (
            <IconButton
              size="small"
              onClick={onDelete}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </>
      )}
    </MessageTools>
  );
};
