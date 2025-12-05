/**
 * useMessageActions Hook
 *
 * Encapsulates message editing and deletion logic.
 * Provides handlers and state management for message actions.
 */

import { useState, useCallback } from "react";
import type { Message as MessageType, FileMetadata, Span } from "../../types/message.type";
import { SpanType } from "../../types/message.type";
import { spansToText, parseMessageWithMentions } from "../../utils/mentionParser";
import {
  useUpdateMessageMutation,
  useDeleteMessageMutation,
  useAddReactionMutation,
  useRemoveReactionMutation,
} from "../../features/messages/messagesApiSlice";
import {
  usePinMessageMutation,
  useUnpinMessageMutation,
} from "../../features/moderation/moderationApiSlice";
import { logger } from "../../utils/logger";

export interface UseMessageActionsReturn {
  isEditing: boolean;
  editText: string;
  editAttachments: FileMetadata[];
  stagedForDelete: boolean;
  isDeleting: boolean;
  setEditText: (text: string) => void;
  handleEditClick: () => void;
  handleEditSave: () => Promise<void>;
  handleEditCancel: () => void;
  handleRemoveAttachment: (attachmentId: string) => void;
  handleDeleteClick: () => void;
  handleConfirmDelete: () => Promise<void>;
  handleCancelDelete: () => void;
  handleReactionClick: (emoji: string) => Promise<void>;
  handleEmojiSelect: (emoji: string) => Promise<void>;
  handlePin: () => Promise<void>;
  handleUnpin: () => Promise<void>;
}

/**
 * Custom hook for managing message editing, deletion, and reactions
 */
export function useMessageActions(
  message: MessageType,
  currentUserId: string | undefined
): UseMessageActionsReturn {
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const [addReaction] = useAddReactionMutation();
  const [removeReaction] = useRemoveReactionMutation();
  const [pinMessage] = usePinMessageMutation();
  const [unpinMessage] = useUnpinMessageMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editAttachments, setEditAttachments] = useState<FileMetadata[]>([]);
  const [stagedForDelete, setStagedForDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditClick = useCallback(() => {
    // Convert all spans (including mentions) to editable text
    const fullText = spansToText(message.spans);
    setEditText(fullText);
    // Initialize edit attachments with current attachments
    setEditAttachments([...message.attachments]);
    setIsEditing(true);
  }, [message.spans, message.attachments]);

  const handleEditSave = useCallback(async () => {
    if (!message.channelId && !message.directMessageGroupId) return;

    try {
      // Extract mentioned users from original message to preserve mentions
      const mentionedUsers = message.spans
        .filter(span => span.type === SpanType.USER_MENTION && span.userId)
        .map(span => ({
          id: span.userId!,
          username: span.text?.replace('@', '') || 'user',
          displayName: span.text?.replace('@', '') || 'user',
        }));

      // Parse edited text back to spans, preserving existing mentions
      let parsedSpans: Span[] = parseMessageWithMentions(editText, mentionedUsers);

      // Ensure at least one span exists
      if (parsedSpans.length === 0) {
        parsedSpans = [{ type: SpanType.PLAINTEXT, text: editText || '' }];
      }

      await updateMessage({
        id: message.id,
        channelId: message.channelId,
        data: {
          spans: parsedSpans,
          attachments: editAttachments.map(att => att.id),
        },
        originalAttachments: message.attachments,
      }).unwrap();
      setIsEditing(false);
      setEditText("");
      setEditAttachments([]);
    } catch (error) {
      logger.error("Failed to update message:", error);
    }
  }, [message, editText, editAttachments, updateMessage]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditText("");
    setEditAttachments([]);
  }, []);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setEditAttachments(prev => prev.filter(att => att.id !== attachmentId));
  }, []);

  const handleDeleteClick = useCallback(() => {
    setStagedForDelete(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!message.channelId) return;

    setIsDeleting(true);

    // Wait for animation to complete before actually deleting
    setTimeout(async () => {
      try {
        await deleteMessage({
          id: message.id,
          channelId: message.channelId!,
        }).unwrap();
      } catch (error) {
        logger.error("Failed to delete message:", error);
        setIsDeleting(false);
        setStagedForDelete(false);
      }
    }, 300); // Match the animation duration
  }, [message.id, message.channelId, deleteMessage]);

  const handleCancelDelete = useCallback(() => {
    setStagedForDelete(false);
  }, []);

  const handleReactionClick = useCallback(async (emoji: string) => {
    if (!currentUserId) return;

    const reaction = message.reactions.find(r => r.emoji === emoji);
    const userHasReacted = reaction?.userIds.includes(currentUserId) ?? false;

    try {
      if (userHasReacted) {
        await removeReaction({ messageId: message.id, emoji });
      } else {
        await addReaction({ messageId: message.id, emoji });
      }
    } catch (error) {
      logger.error("Failed to update reaction:", error);
    }
  }, [currentUserId, message.reactions, message.id, addReaction, removeReaction]);

  const handleEmojiSelect = useCallback(async (emoji: string) => {
    try {
      await addReaction({ messageId: message.id, emoji });
    } catch (error) {
      logger.error("Failed to add reaction:", error);
    }
  }, [message.id, addReaction]);

  const handlePin = useCallback(async () => {
    try {
      await pinMessage(message.id).unwrap();
    } catch (error) {
      logger.error("Failed to pin message:", error);
    }
  }, [message.id, pinMessage]);

  const handleUnpin = useCallback(async () => {
    try {
      await unpinMessage(message.id).unwrap();
    } catch (error) {
      logger.error("Failed to unpin message:", error);
    }
  }, [message.id, unpinMessage]);

  return {
    isEditing,
    editText,
    editAttachments,
    stagedForDelete,
    isDeleting,
    setEditText,
    handleEditClick,
    handleEditSave,
    handleEditCancel,
    handleRemoveAttachment,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
    handleReactionClick,
    handleEmojiSelect,
    handlePin,
    handleUnpin,
  };
}
