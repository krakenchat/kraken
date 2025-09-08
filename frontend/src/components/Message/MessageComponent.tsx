import Avatar from "@mui/material/Avatar";
import { styled, Typography, IconButton, Box, TextField } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CancelIcon from "@mui/icons-material/Cancel";
import type { Message as MessageType, Span } from "../../types/message.type";
import { SpanType } from "../../types/message.type";
import {
  useGetUserByIdWithCacheQuery,
  useProfileQuery,
} from "../../features/users/usersSlice";
import { alpha } from '@mui/material/styles';
import {
  useUpdateMessageMutation,
  useDeleteMessageMutation,
  useAddReactionMutation,
  useRemoveReactionMutation,
} from "../../features/messages/messagesApiSlice";
import { MessageReactions } from "./MessageReactions";
import { EmojiPicker } from "./EmojiPicker";
import { useState, useMemo } from "react";
import { useCanPerformAction } from "../../features/roles/useUserPermissions";

interface MessageProps {
  message: MessageType;
}

function renderSpan(span: Span, idx: number) {
  switch (span.type) {
    case SpanType.USER_MENTION:
      return (
        <span key={idx} style={{ color: "#1976d2", fontWeight: 600 }}>
          {span.text || span.userId}
        </span>
      );
    case SpanType.SPECIAL_MENTION:
      return (
        <span key={idx} style={{ color: "#388e3c", fontWeight: 600 }}>
          @{span.specialKind}
        </span>
      );
    case SpanType.COMMUNITY_MENTION:
      return (
        <span key={idx} style={{ color: "#0288d1", fontWeight: 600 }}>
          {span.text || span.communityId}
        </span>
      );
    case SpanType.ALIAS_MENTION:
      return (
        <span key={idx} style={{ color: "#fbc02d", fontWeight: 600 }}>
          {span.text || span.aliasId}
        </span>
      );
    case SpanType.PLAINTEXT:
    default:
      return <span key={idx}>{span.text}</span>;
  }
}

const Container = styled("div", {
  shouldForwardProp: (prop) =>
    prop !== "stagedForDelete" && prop !== "isDeleting" && prop !== "isHighlighted",
})<{ stagedForDelete?: boolean; isDeleting?: boolean; isHighlighted?: boolean }>(
  ({ theme, stagedForDelete, isDeleting, isHighlighted }) => ({
    padding: theme.spacing(0.5, 2),
    display: "flex",
    alignItems: "flex-start",
    width: "100%",
    marginBottom: isDeleting ? 0 : theme.spacing(1),
    position: "relative",
    backgroundColor: isHighlighted 
      ? alpha(theme.palette.primary.main, 0.08)
      : "transparent",
    border: stagedForDelete
      ? `2px solid ${theme.palette.error.main}`
      : isHighlighted
      ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
      : "2px solid transparent",
    borderRadius: stagedForDelete ? theme.spacing(1) : 0,
    transition: isDeleting ? "all 0.3s ease-out" : "all 0.2s ease-in-out",
    opacity: isDeleting ? 0 : 1,
    transform: isDeleting
      ? "translateY(-10px) scale(0.98)"
      : "translateY(0) scale(1)",
    maxHeight: isDeleting ? 0 : "none",
    overflow: isDeleting ? "hidden" : "visible",
    paddingTop: isDeleting ? 0 : theme.spacing(0.5),
    paddingBottom: isDeleting ? 0 : theme.spacing(0.5),
    "&:hover": {
      backgroundColor: stagedForDelete
        ? theme.palette.error.light
        : isHighlighted
        ? alpha(theme.palette.primary.main, 0.12)
        : theme.palette.action.hover,
      "& .message-tools": {
        opacity: 1,
      },
    },
  })
);

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

function MessageComponent({ message }: MessageProps) {
  const { data: author } = useGetUserByIdWithCacheQuery(message.authorId);
  const { data: currentUser } = useProfileQuery();
  
  // Check if this message mentions the current user
  const isMentioned = currentUser && message.spans.some(span => {
    if (span.type === SpanType.USER_MENTION && span.userId === currentUser.id) {
      return true;
    }
    if (span.type === SpanType.SPECIAL_MENTION && (span.specialKind === 'here' || span.specialKind === 'channel')) {
      // User is mentioned by @here/@channel if they are in the channel
      // For now, we'll assume they are since they can see the message
      return true;
    }
    return false;
  });
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const [addReaction] = useAddReactionMutation();
  const [removeReaction] = useRemoveReactionMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [stagedForDelete, setStagedForDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnMessage = currentUser?.id === message.authorId;

  // Check if user can moderate messages in this channel
  const canUpdateMessage = useCanPerformAction("CHANNEL", message.channelId, "UPDATE_MESSAGE");
  const canDeleteMessage = useCanPerformAction("CHANNEL", message.channelId, "DELETE_MESSAGE");

  // Combined permission checks: owner can always edit/delete, or user has moderator permissions
  const canEditMessage = useMemo(() => {
    return isOwnMessage || canUpdateMessage;
  }, [isOwnMessage, canUpdateMessage]);

  const canRemoveMessage = useMemo(() => {
    return isOwnMessage || canDeleteMessage;
  }, [isOwnMessage, canDeleteMessage]);

  const handleEditClick = () => {
    // Get the text from the first plaintext span or empty string
    const textSpan = message.spans.find(
      (span) => span.type === SpanType.PLAINTEXT
    );
    setEditText(textSpan?.text || "");
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (!message.channelId) return;

    try {
      await updateMessage({
        id: message.id,
        channelId: message.channelId,
        data: {
          spans: [{ type: SpanType.PLAINTEXT, text: editText }],
          editedAt: new Date().toISOString(),
        },
      }).unwrap();
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update message:", error);
    }
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditText("");
  };

  const handleDeleteClick = () => {
    setStagedForDelete(true);
  };

  const handleConfirmDelete = async () => {
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
        console.error("Failed to delete message:", error);
        setIsDeleting(false);
        setStagedForDelete(false);
      }
    }, 300); // Match the animation duration
  };

  const handleCancelDelete = () => {
    setStagedForDelete(false);
  };

  const handleReactionClick = async (emoji: string) => {
    if (!currentUser) return;

    const reaction = message.reactions.find(r => r.emoji === emoji);
    const userHasReacted = reaction?.userIds.includes(currentUser.id) ?? false;

    try {
      if (userHasReacted) {
        await removeReaction({ messageId: message.id, emoji });
      } else {
        await addReaction({ messageId: message.id, emoji });
      }
    } catch (error) {
      console.error("Failed to update reaction:", error);
    }
  };

  const handleEmojiSelect = async (emoji: string) => {
    try {
      await addReaction({ messageId: message.id, emoji });
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  return (
    <Container 
      stagedForDelete={stagedForDelete} 
      isDeleting={isDeleting}
      isHighlighted={isMentioned}
    >
      <div style={{ marginRight: 12, marginTop: 4 }}>
        {author?.avatarUrl ? (
          <Avatar
            src={author.avatarUrl}
            alt={author.displayName || author.username}
            sx={{ width: 32, height: 32 }}
          />
        ) : (
          <Avatar sx={{ width: 32, height: 32 }}>
            {author?.displayName?.[0] || author?.username?.[0] || "?"}
          </Avatar>
        )}
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
            <TextField
              size="small"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              fullWidth
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSave();
                } else if (e.key === "Escape") {
                  handleEditCancel();
                }
              }}
            />
            <IconButton
              size="small"
              onClick={handleEditSave}
              disabled={!editText.trim()}
              color="primary"
            >
              <CheckIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={handleEditCancel}>
              <CancelIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <>
            <Typography variant="body1">
              {message.spans.map((span, idx) => renderSpan(span, idx))}
            </Typography>
            <MessageReactions
              messageId={message.id}
              reactions={message.reactions}
              onReactionClick={handleReactionClick}
            />
          </>
        )}
      </div>
      {(canEditMessage || canRemoveMessage) && !isEditing && (
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
                onClick={handleConfirmDelete}
                color="error"
              >
                <CheckIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={handleCancelDelete}>
                <CancelIcon fontSize="small" />
              </IconButton>
            </>
          ) : (
            <>
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              {canEditMessage && (
                <IconButton size="small" onClick={handleEditClick}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {canRemoveMessage && (
                <IconButton
                  size="small"
                  onClick={handleDeleteClick}
                  color="error"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </>
          )}
        </MessageTools>
      )}
    </Container>
  );
}

export default MessageComponent;
