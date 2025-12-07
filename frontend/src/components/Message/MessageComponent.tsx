/**
 * MessageComponent
 *
 * Main message display component.
 * Orchestrates message rendering, editing, deletion, and reactions.
 */

import React from "react";
import { Typography, Tooltip, Box } from "@mui/material";
import PushPinIcon from "@mui/icons-material/PushPin";
import type { Message as MessageType } from "../../types/message.type";
import { useGetUserByIdQuery, useProfileQuery } from "../../features/users/usersSlice";
import { useMessagePermissions } from "../../hooks/useMessagePermissions";
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
  isAuthor?: boolean;
  isSearchHighlight?: boolean;
}

function MessageComponentInner({ message, isSearchHighlight }: MessageProps) {
  const { data: author } = useGetUserByIdQuery(message.authorId);
  const { data: currentUser } = useProfileQuery();

  // Check if this message mentions the current user
  const isMentioned = isUserMentioned(message, currentUser?.id);

  // Use extracted hook for cleaner permission logic
  const { canEdit, canDelete, canPin } = useMessagePermissions({
    message,
    currentUserId: currentUser?.id,
  });

  const isPinned = message.pinned === true;

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
    handlePin,
    handleUnpin,
  } = useMessageActions(message, currentUser?.id);

  return (
    <Container
      stagedForDelete={stagedForDelete}
      isDeleting={isDeleting}
      isHighlighted={isMentioned}
      isSearchHighlight={isSearchHighlight}
    >
      <div style={{ marginRight: 12, marginTop: 4 }}>
        <UserAvatar user={author} size="small" />
      </div>
      <div style={{ flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {author?.displayName || author?.username || message.authorId}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
          >
            {new Date(message.sentAt).toLocaleString()}
            {message.editedAt && (
              <span style={{ marginLeft: 4 }}>(edited)</span>
            )}
          </Typography>
          {isPinned && (
            <Tooltip title="Pinned message">
              <PushPinIcon
                sx={{
                  fontSize: 14,
                  color: "primary.main",
                  ml: 0.5,
                }}
              />
            </Tooltip>
          )}
        </Box>
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
      {(canEdit || canDelete || canPin) && !isEditing && (
        <MessageToolbar
          canEdit={canEdit}
          canDelete={canDelete}
          canPin={canPin}
          isPinned={isPinned}
          stagedForDelete={stagedForDelete}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onConfirmDelete={handleConfirmDelete}
          onCancelDelete={handleCancelDelete}
          onEmojiSelect={handleEmojiSelect}
          onPin={handlePin}
          onUnpin={handleUnpin}
        />
      )}
    </Container>
  );
}

/**
 * Memoized message component to prevent unnecessary re-renders in lists.
 * Only re-renders when the message data actually changes.
 */
const MessageComponent = React.memo(MessageComponentInner, (prevProps, nextProps) => {
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;

  // Compare message properties that would require a re-render
  return (
    prevMsg.id === nextMsg.id &&
    prevMsg.content === nextMsg.content &&
    prevMsg.editedAt === nextMsg.editedAt &&
    prevMsg.authorId === nextMsg.authorId &&
    prevMsg.sentAt === nextMsg.sentAt &&
    prevMsg.pinned === nextMsg.pinned &&
    prevProps.isSearchHighlight === nextProps.isSearchHighlight &&
    // Deep compare reactions array
    prevMsg.reactions.length === nextMsg.reactions.length &&
    prevMsg.reactions.every((r, i) =>
      r.emoji === nextMsg.reactions[i]?.emoji &&
      r.count === nextMsg.reactions[i]?.count
    ) &&
    // Deep compare attachments array
    prevMsg.attachments?.length === nextMsg.attachments?.length &&
    prevMsg.attachments?.every((a, i) => a.id === nextMsg.attachments?.[i]?.id)
  );
});

export default MessageComponent;
