/**
 * MessageContextMenu
 *
 * Right-click context menu for messages in the Electron app.
 * Provides quick access to message actions: reply, react, pin, edit, delete, copy.
 * On web, the native browser context menu is preserved (this component is not rendered).
 */

import React, { useCallback } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import AddReactionIcon from '@mui/icons-material/AddReaction';
import PushPinIcon from '@mui/icons-material/PushPin';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { Message } from '../../types/message.type';
import { spansToText } from '../../utils/mentionParser';

export interface MessageContextMenuProps {
  anchorPosition: { top: number; left: number } | null;
  open: boolean;
  onClose: () => void;
  message: Message;
  // Permissions
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  canReact: boolean;
  canThread: boolean;
  isPinned: boolean;
  // Actions
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onReplyInThread: () => void;
  onQuoteReply?: () => void;
  onAddReaction: () => void;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  anchorPosition,
  open,
  onClose,
  message,
  canEdit,
  canDelete,
  canPin,
  canReact,
  canThread,
  isPinned,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReplyInThread,
  onQuoteReply,
  onAddReaction,
}) => {
  const handleCopyContent = useCallback(() => {
    const text = spansToText(message.spans);
    if (window.electronAPI?.writeClipboard) {
      window.electronAPI.writeClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    onClose();
  }, [message.spans, onClose]);

  const handleQuoteReply = useCallback(() => {
    onQuoteReply?.();
    onClose();
  }, [onQuoteReply, onClose]);

  const handleReplyInThread = useCallback(() => {
    onReplyInThread();
    onClose();
  }, [onReplyInThread, onClose]);

  const handleAddReaction = useCallback(() => {
    onAddReaction();
    onClose();
  }, [onAddReaction, onClose]);

  const handlePin = useCallback(() => {
    if (isPinned) {
      onUnpin();
    } else {
      onPin();
    }
    onClose();
  }, [isPinned, onPin, onUnpin, onClose]);

  const handleEdit = useCallback(() => {
    onEdit();
    onClose();
  }, [onEdit, onClose]);

  const handleDelete = useCallback(() => {
    onDelete();
    onClose();
  }, [onDelete, onClose]);

  const hasReplyItems = !!onQuoteReply || canThread;
  const hasMiddleItems = canPin || canEdit || canDelete;

  return (
    <Menu
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ?? undefined}
      open={open}
      onClose={onClose}
    >
      {/* Reply actions */}
      {onQuoteReply && (
        <MenuItem onClick={handleQuoteReply}>
          <ListItemIcon>
            <FormatQuoteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reply</ListItemText>
        </MenuItem>
      )}
      {canThread && (
        <MenuItem onClick={handleReplyInThread}>
          <ListItemIcon>
            <ChatBubbleOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reply in Thread</ListItemText>
        </MenuItem>
      )}

      {/* Divider between reply actions and reaction */}
      {hasReplyItems && <Divider />}

      {/* Add Reaction */}
      {canReact && (
        <MenuItem onClick={handleAddReaction}>
          <ListItemIcon>
            <AddReactionIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add Reaction</ListItemText>
        </MenuItem>
      )}

      {/* Divider between reaction and moderation/edit actions */}
      {canReact && hasMiddleItems && <Divider />}

      {/* Pin/Unpin */}
      {canPin && (
        <MenuItem onClick={handlePin}>
          <ListItemIcon>
            <PushPinIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isPinned ? 'Unpin Message' : 'Pin Message'}</ListItemText>
        </MenuItem>
      )}

      {/* Edit */}
      {canEdit && (
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Message</ListItemText>
        </MenuItem>
      )}

      {/* Delete */}
      {canDelete && (
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Message</ListItemText>
        </MenuItem>
      )}

      {/* Divider before copy */}
      <Divider />

      {/* Copy Message Content — always shown */}
      <MenuItem onClick={handleCopyContent}>
        <ListItemIcon>
          <ContentCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Copy Message Content</ListItemText>
      </MenuItem>
    </Menu>
  );
};

export default MessageContextMenu;
