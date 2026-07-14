/**
 * MessageToolbar Component
 *
 * Floating toolbar for message actions (edit, delete, react, pin).
 * Shows on hover with confirmation UI for destructive actions.
 */

import React from "react";
import { Box, IconButton, Typography, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CancelIcon from "@mui/icons-material/Cancel";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
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
  canPin: boolean;
  canThread: boolean;
  isPinned: boolean;
  stagedForDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onEmojiSelect: (emoji: string) => void;
  onPin: () => void;
  onUnpin: () => void;
  onReplyInThread: () => void;
  onQuoteReply?: () => void;
  /** Community for the custom-emoji reaction section (channels only). */
  communityId?: string | null;
}

export const MessageToolbar: React.FC<MessageToolbarProps> = ({
  canEdit,
  canDelete,
  canPin,
  canThread,
  isPinned,
  stagedForDelete,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onEmojiSelect,
  onPin,
  onUnpin,
  onReplyInThread,
  onQuoteReply,
  communityId,
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
            aria-label="Confirm delete"
          >
            <CheckIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onCancelDelete} aria-label="Cancel delete">
            <CancelIcon fontSize="small" />
          </IconButton>
        </>
      ) : (
        <>
          <EmojiPicker
            onEmojiSelect={onEmojiSelect}
            communityId={communityId}
            onCustomEmojiSelect={(emoji) => onEmojiSelect(`custom:${emoji.id}`)}
          />
          {onQuoteReply && (
            <Tooltip title="Quote reply">
              <IconButton size="small" onClick={onQuoteReply} aria-label="Quote reply">
                <FormatQuoteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canThread && (
            <Tooltip title="Reply in thread">
              <IconButton size="small" onClick={onReplyInThread} aria-label="Reply in thread">
                <ChatBubbleOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canPin && (
            <Tooltip title={isPinned ? "Unpin message" : "Pin message"}>
              <IconButton
                size="small"
                onClick={isPinned ? onUnpin : onPin}
                sx={{ color: isPinned ? "primary.main" : undefined }}
                aria-label={isPinned ? "Unpin message" : "Pin message"}
              >
                {isPinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
          {canEdit && (
            <IconButton size="small" onClick={onEdit} aria-label="Edit message">
              <EditIcon fontSize="small" />
            </IconButton>
          )}
          {canDelete && (
            <IconButton
              size="small"
              onClick={onDelete}
              color="error"
              aria-label="Delete message"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </>
      )}
    </MessageTools>
  );
};
