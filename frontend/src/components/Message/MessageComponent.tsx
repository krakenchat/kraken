/**
 * MessageComponent
 *
 * Main message display component.
 * Orchestrates message rendering, editing, deletion, and reactions.
 */

import React, { useMemo } from "react";
import { Typography } from "@mui/material";
import type { Message as MessageType } from "../../types/message.type";
import { useGetUserByIdQuery, useProfileQuery } from "../../features/users/usersSlice";
import { useCanPerformAction } from "../../features/roles/useUserPermissions";
import { MessageReactions } from "./MessageReactions";
import { MessageAttachments } from "./MessageAttachments";
import { MessageEditForm } from "./MessageEditForm";
import { MessageToolbar } from "./MessageToolbar";
import { renderMessageSpans } from "./MessageSpan";
import { Container } from "./MessageComponentStyles";
import { useMessageActions } from "./useMessageActions";
import { isUserMentioned } from "./messageUtils";
import UserAvatar from "../Common/UserAvatar";

interface MessageProps {
  message: MessageType;
}

function MessageComponent({ message }: MessageProps) {
  const { data: author } = useGetUserByIdQuery(message.authorId);
  const { data: currentUser } = useProfileQuery();

  // Check if this message mentions the current user
  const isMentioned = isUserMentioned(message, currentUser?.id);

  const isOwnMessage = currentUser?.id === message.authorId;

  // Check if user can moderate messages in this channel
  const canDeleteMessage = useCanPerformAction("CHANNEL", message.channelId, "DELETE_MESSAGE");

  // Users can edit their own messages (backend MessageOwnershipGuard handles all permission logic)
  const canEditMessage = useMemo(() => {
    return isOwnMessage;
  }, [isOwnMessage]);

  // Users can delete their own messages (backend MessageOwnershipGuard handles all logic)
  // Users with DELETE_MESSAGE permission can delete any message
  const canRemoveMessage = useMemo(() => {
    return isOwnMessage || canDeleteMessage;
  }, [isOwnMessage, canDeleteMessage]);

  const {
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
  } = useMessageActions(message, currentUser?.id);

  return (
    <Container
      stagedForDelete={stagedForDelete}
      isDeleting={isDeleting}
      isHighlighted={isMentioned}
    >
      <div style={{ marginRight: 12, marginTop: 4 }}>
        <UserAvatar user={author} size="small" />
      </div>
      <div style={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {author?.displayName || author?.username || message.authorId}
          <Typography
            sx={{ marginLeft: "6px" }}
            variant="caption"
            color="text.secondary"
          >
            {new Date(message.sentAt).toLocaleString()}
            {message.editedAt && (
              <span style={{ marginLeft: 4 }}>(edited)</span>
            )}
          </Typography>
        </Typography>
        {isEditing ? (
          <MessageEditForm
            editText={editText}
            editAttachments={editAttachments}
            onTextChange={setEditText}
            onSave={handleEditSave}
            onCancel={handleEditCancel}
            onRemoveAttachment={handleRemoveAttachment}
          />
        ) : (
          <>
            <Typography variant="body1">
              {renderMessageSpans(message.spans)}
            </Typography>
            <MessageAttachments attachments={message.attachments} />
            <MessageReactions
              messageId={message.id}
              reactions={message.reactions}
              onReactionClick={handleReactionClick}
            />
          </>
        )}
      </div>
      {(canEditMessage || canRemoveMessage) && !isEditing && (
        <MessageToolbar
          canEdit={canEditMessage}
          canDelete={canRemoveMessage}
          stagedForDelete={stagedForDelete}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onConfirmDelete={handleConfirmDelete}
          onCancelDelete={handleCancelDelete}
          onEmojiSelect={handleEmojiSelect}
        />
      )}
    </Container>
  );
}

export default MessageComponent;
