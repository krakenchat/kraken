/**
 * MessageComponent
 *
 * Main message display component.
 * Orchestrates message rendering, editing, deletion, and reactions.
 */

import React, { useState, useCallback } from "react";
import { Avatar, Typography, Tooltip, Box, Chip, Link } from "@mui/material";
import PushPinIcon from "@mui/icons-material/PushPin";
import type { Message as MessageType } from "../../types/message.type";
import { useQuery } from "@tanstack/react-query";
import { userControllerGetUserByIdOptions } from "../../api-client/@tanstack/react-query.gen";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useMessagePermissions } from "../../hooks/useMessagePermissions";
import { MessageReactions } from "./MessageReactions";
import { MessageAttachments } from "./MessageAttachments";
import { MessageLinkPreviews } from "./MessageLinkPreviews";
import { MessageEditForm } from "./MessageEditForm";
import { MessageToolbar } from "./MessageToolbar";
import { renderMessageSpans } from "./MessageSpan";
import { Container } from "./MessageComponentStyles";
import { useMessageActions } from "./useMessageActions";
import { isUserMentioned, isSoleTenorGifLink } from "./messageUtils";
import UserAvatar from "../Common/UserAvatar";
import ConfirmDialog from "../Common/ConfirmDialog";
import { ThreadReplyBadge } from "../Thread/ThreadReplyBadge";
import QuotePreview from "./QuotePreview";
import { useUserProfile } from "../../contexts/UserProfileContext";
import { SeenByTooltip } from "./SeenByTooltip";
import { VoiceSessionType } from "../../contexts/VoiceContext";
import MessageContextMenu from "./MessageContextMenu";
import MessageActionsSheet from "./MessageActionsSheet";
import { EmojiPickerPopover } from "./EmojiPicker";
import { useResponsive } from "../../hooks/useResponsive";
import { useLongPress } from "../../hooks/useSwipeGesture";
import { useCommunityCustomEmojis } from "../../hooks/useCommunityCustomEmojis";
import { useContextMenuFocusRestore } from "../../hooks/useContextMenuFocusRestore";

interface MessageProps {
  message: MessageType;
  isAuthor?: boolean;
  isSearchHighlight?: boolean;
  contextId?: string;
  communityId?: string;
  isThreadParent?: boolean;
  isThreadReply?: boolean;
  onOpenThread?: (message: MessageType) => void;
  onQuoteReply?: (message: MessageType) => void;
  /** Context type to determine if read receipts should be shown */
  contextType?: VoiceSessionType;
}

function MessageComponentInner({
  message,
  isAuthor,
  isSearchHighlight,
  contextId,
  communityId,
  isThreadParent,
  isThreadReply,
  onOpenThread,
  onQuoteReply,
  contextType,
}: MessageProps) {
  // Community custom emojis (for rendering EMOJI spans + custom reactions).
  const { byId: emojiById } = useCommunityCustomEmojis(communityId);
  const isWebhookMessage = !!message.webhook;
  const { data: author } = useQuery({
    ...userControllerGetUserByIdOptions({ path: { id: message.authorId ?? '' } }),
    // Webhook messages have no authorId — skip the user lookup entirely.
    enabled: !!message.authorId && !isWebhookMessage,
  });
  const { user: currentUser } = useCurrentUser();
  const { openProfile } = useUserProfile();

  // Check if this message mentions the current user
  const isMentioned = isUserMentioned(message, currentUser?.id);

  // Use extracted hook for cleaner permission logic
  const { canEdit, canDelete, canPin, canReact } = useMessagePermissions({
    message,
    currentUserId: currentUser?.id,
  });

  const isPinned = message.pinned === true;

  // Thread logic: Can start a thread if not already a thread reply and handler is provided
  const canThread = !isThreadReply && !isThreadParent && !!onOpenThread;
  const hasReplies = (message.replyCount ?? 0) > 0;

  const handleOpenThread = () => {
    if (onOpenThread) {
      onOpenThread(message);
    }
  };

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
    handleConfirmThreadDelete,
    handleCancelThreadDelete,
    showThreadDeleteConfirm,
    handleReactionClick,
    handleEmojiSelect,
    handlePin,
    handleUnpin,
  } = useMessageActions(message, currentUser?.id);

  const { shouldUseTouchUI } = useResponsive();

  // Context menu state
  const [contextMenuPosition, setContextMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);

  const { captureTrigger, restoreFocus } = useContextMenuFocusRestore();

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    captureTrigger(event.currentTarget as HTMLElement);
    setContextMenuPosition({ top: event.clientY, left: event.clientX });
  }, [captureTrigger]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuPosition(null);
    // Right-click (and long-press) open this menu with no keyboard-reachable
    // invoker button, so — unlike an anchorEl Menu — MUI can't auto-restore
    // focus. Return it to the message row itself.
    restoreFocus();
  }, [restoreFocus]);

  const handleAddReaction = useCallback(() => {
    // Save position for emoji picker, close context menu
    setEmojiPickerPosition(contextMenuPosition);
    setContextMenuPosition(null);
  }, [contextMenuPosition]);

  // Touch: long-press opens the mobile actions sheet
  const handleOpenActionsSheet = useCallback(() => {
    setActionsSheetOpen(true);
  }, []);

  const longPress = useLongPress(handleOpenActionsSheet, {
    enabled: shouldUseTouchUI && !isEditing,
  });

  // Touch: "Add Reaction" / "+" opens the emoji picker (as a bottom sheet)
  const handleSheetAddReaction = useCallback(() => {
    setEmojiPickerOpen(true);
  }, []);

  const handleCloseEmojiPicker = useCallback(() => {
    setEmojiPickerPosition(null);
    setEmojiPickerOpen(false);
    // Reuses the same trigger captured on right-click: "Add Reaction" is
    // reached via the context menu, so closing the emoji picker should
    // return focus to the message row too (a no-op if it was opened via
    // the touch sheet instead, since no trigger was captured for that path).
    restoreFocus();
  }, [restoreFocus]);

  // Under touch UI, wire long-press handlers and suppress native selection /
  // context menu; otherwise keep desktop right-click behavior untouched.
  // While editing on touch, attach nothing so native text selection and the
  // clipboard callout work inside the edit form.
  const containerInteractionProps = shouldUseTouchUI
    ? isEditing
      ? {}
      : {
          onTouchStart: longPress.onTouchStart,
          onTouchMove: longPress.onTouchMove,
          onTouchEnd: longPress.onTouchEnd,
          onTouchCancel: longPress.onTouchCancel,
          onContextMenu: longPress.onContextMenu,
          style: { WebkitTouchCallout: "none", userSelect: "none" } as React.CSSProperties,
        }
    : { onContextMenu: handleContextMenu };

  return (
    <Container
      stagedForDelete={stagedForDelete}
      isDeleting={isDeleting}
      isHighlighted={isMentioned}
      isSearchHighlight={isSearchHighlight}
      // Not in tab order (-1) — only focused programmatically, to restore
      // focus here after the right-click/long-press context menu closes.
      tabIndex={-1}
      {...containerInteractionProps}
    >
      <div style={{ marginRight: 12, marginTop: 4 }}>
        {isWebhookMessage ? (
          <Avatar
            src={message.webhook?.avatarUrl ?? undefined}
            sx={{ width: 32, height: 32 }}
          >
            {message.webhook!.name.charAt(0).toUpperCase()}
          </Avatar>
        ) : (
          <UserAvatar
            userId={message.authorId ?? undefined}
            size="small"
            clickable={!!message.authorId}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {isWebhookMessage ? (
            <>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: "text.primary" }}
              >
                {message.webhook!.name}
              </Typography>
              <Chip label="APP" size="small" sx={{ height: 18, fontSize: 10 }} />
            </>
          ) : message.authorId ? (
            <Link
              component="button"
              variant="body2"
              onClick={() => openProfile(message.authorId!)}
              sx={{
                fontWeight: 700,
                color: "text.primary",
                textDecoration: "none",
                cursor: "pointer",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              {author?.displayName || author?.username || message.authorId}
            </Link>
          ) : (
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: "text.secondary",
                fontStyle: "italic",
              }}
            >
              [Deleted User]
            </Typography>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "inline-flex", alignItems: "center" }}
          >
            {new Date(message.sentAt).toLocaleString()}
            {message.editedAt && (
              <span style={{ marginLeft: 4 }}>(edited)</span>
            )}
            {/* Show read status for own messages in DMs with "seen by" tooltip */}
            {contextType === VoiceSessionType.Dm && isAuthor && contextId && (
              <SeenByTooltip
                sentAt={message.sentAt}
                directMessageGroupId={contextId}
              />
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
        {message.replyTo && (
          <QuotePreview
            replyTo={message.replyTo}
            channelId={message.channelId}
            directMessageGroupId={message.directMessageGroupId}
          />
        )}
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
            {!isSoleTenorGifLink(message) && (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {renderMessageSpans(message.spans, emojiById)}
              </Typography>
            )}
            <MessageAttachments attachments={message.attachments} />
            <MessageLinkPreviews linkPreviews={message.linkPreviews} />
            <MessageReactions
              messageId={message.id}
              reactions={message.reactions}
              onReactionClick={handleReactionClick}
              emojiById={emojiById}
            />
            {/* Show thread reply badge if message has replies and not in thread context */}
            {hasReplies && !isThreadParent && !isThreadReply && (
              <ThreadReplyBadge
                replyCount={message.replyCount ?? 0}
                lastReplyAt={message.lastReplyAt}
                onClick={handleOpenThread}
              />
            )}
          </>
        )}
      </div>
      {(canEdit || canDelete || canPin || canReact || canThread) && !isEditing && (
        <MessageToolbar
          canEdit={canEdit}
          canDelete={canDelete}
          canPin={canPin}
          canThread={canThread}
          isPinned={isPinned}
          stagedForDelete={stagedForDelete}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onConfirmDelete={handleConfirmDelete}
          onCancelDelete={handleCancelDelete}
          onEmojiSelect={handleEmojiSelect}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onReplyInThread={handleOpenThread}
          onQuoteReply={onQuoteReply && !message.deletedAt ? () => onQuoteReply(message) : undefined}
          communityId={communityId}
        />
      )}
      <ConfirmDialog
        open={showThreadDeleteConfirm}
        title="Delete Message"
        description={`This message has ${message.replyCount ?? 0} thread ${(message.replyCount ?? 0) === 1 ? 'reply' : 'replies'}. Deleting it will also delete all replies.`}
        confirmLabel="Delete All"
        confirmColor="error"
        onConfirm={handleConfirmThreadDelete}
        onCancel={handleCancelThreadDelete}
      />
      <MessageContextMenu
        anchorPosition={contextMenuPosition}
        open={Boolean(contextMenuPosition)}
        onClose={handleCloseContextMenu}
        message={message}
        canEdit={canEdit}
        canDelete={canDelete}
        canPin={canPin}
        canReact={canReact}
        canThread={canThread}
        isPinned={isPinned}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onReplyInThread={handleOpenThread}
        onQuoteReply={onQuoteReply && !message.deletedAt ? () => onQuoteReply(message) : undefined}
        onAddReaction={handleAddReaction}
      />
      {shouldUseTouchUI && (
        <MessageActionsSheet
          open={actionsSheetOpen}
          onClose={() => setActionsSheetOpen(false)}
          anchorPosition={null}
          message={message}
          canEdit={canEdit}
          canDelete={canDelete}
          canPin={canPin}
          canReact={canReact}
          canThread={canThread}
          isPinned={isPinned}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onReplyInThread={handleOpenThread}
          onQuoteReply={onQuoteReply && !message.deletedAt ? () => onQuoteReply(message) : undefined}
          onAddReaction={handleSheetAddReaction}
          onEmojiSelect={handleEmojiSelect}
        />
      )}
      <EmojiPickerPopover
        open={Boolean(emojiPickerPosition) || emojiPickerOpen}
        anchorPosition={emojiPickerPosition}
        onClose={handleCloseEmojiPicker}
        onEmojiSelect={(emoji) => {
          handleEmojiSelect(emoji);
          handleCloseEmojiPicker();
        }}
        communityId={communityId}
        onCustomEmojiSelect={(emoji) => {
          handleEmojiSelect(`custom:${emoji.id}`);
          handleCloseEmojiPicker();
        }}
      />
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
    prevMsg.editedAt === nextMsg.editedAt &&
    prevMsg.authorId === nextMsg.authorId &&
    prevMsg.sentAt === nextMsg.sentAt &&
    prevMsg.pinned === nextMsg.pinned &&
    prevMsg.replyCount === nextMsg.replyCount &&
    prevMsg.lastReplyAt === nextMsg.lastReplyAt &&
    prevMsg.replyToId === nextMsg.replyToId &&
    prevMsg.deletedAt === nextMsg.deletedAt &&
    prevProps.isSearchHighlight === nextProps.isSearchHighlight &&
    prevProps.isThreadParent === nextProps.isThreadParent &&
    prevProps.isThreadReply === nextProps.isThreadReply &&
    prevProps.isAuthor === nextProps.isAuthor &&
    prevProps.contextType === nextProps.contextType &&
    // Deep compare spans array (content equality, not reference)
    prevMsg.spans.length === nextMsg.spans.length &&
    prevMsg.spans.every((s, i) =>
      s.type === nextMsg.spans[i]?.type &&
      s.text === nextMsg.spans[i]?.text
    ) &&
    // Deep compare reactions array (including userIds content)
    prevMsg.reactions.length === nextMsg.reactions.length &&
    prevMsg.reactions.every((r, i) => {
      const prevIds = r.userIds ?? [];
      const nextIds = nextMsg.reactions[i]?.userIds ?? [];
      return (
        r.emoji === nextMsg.reactions[i]?.emoji &&
        prevIds.length === nextIds.length &&
        prevIds.every((uid, j) => uid === nextIds[j])
      );
    }) &&
    // Deep compare attachments array
    prevMsg.attachments?.length === nextMsg.attachments?.length &&
    prevMsg.attachments?.every((a, i) => a.id === nextMsg.attachments?.[i]?.id) &&
    // Compare link previews (length + URLs + titles cover content changes)
    (prevMsg.linkPreviews?.length ?? 0) === (nextMsg.linkPreviews?.length ?? 0) &&
    (prevMsg.linkPreviews?.every((lp, i) =>
      lp.url === nextMsg.linkPreviews?.[i]?.url &&
      lp.title === nextMsg.linkPreviews?.[i]?.title &&
      lp.imageUrl === nextMsg.linkPreviews?.[i]?.imageUrl
    ) ?? true)
  );
});

export default MessageComponent;
