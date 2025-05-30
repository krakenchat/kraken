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
import {
  useUpdateMessageMutation,
  useDeleteMessageMutation,
} from "../../features/messages/messagesApiSlice";
import { useState } from "react";

interface MessageProps {
  message: MessageType;
}

function renderSpan(span: Span, idx: number) {
  switch (span.type) {
    case SpanType.USER_MENTION:
      return (
        <span key={idx} style={{ color: "#1976d2", fontWeight: 600 }}>
          @{span.text || span.userId}
        </span>
      );
    case SpanType.SPECIAL_MENTION:
      return (
        <span key={idx} style={{ color: "#388e3c", fontWeight: 600 }}>
          @{span.text || span.specialKind}
        </span>
      );
    case SpanType.CHANNEL_MENTION:
      return (
        <span key={idx} style={{ color: "#7b1fa2", fontWeight: 600 }}>
          #{span.text || span.channelId}
        </span>
      );
    case SpanType.COMMUNITY_MENTION:
      return (
        <span key={idx} style={{ color: "#0288d1", fontWeight: 600 }}>
          @{span.text || span.communityId}
        </span>
      );
    case SpanType.ALIAS_MENTION:
      return (
        <span key={idx} style={{ color: "#fbc02d", fontWeight: 600 }}>
          @{span.text || span.aliasId}
        </span>
      );
    case SpanType.PLAINTEXT:
    default:
      return <span key={idx}>{span.text}</span>;
  }
}

const Container = styled("div")(({ theme }) => ({
  padding: theme.spacing(0.5, 2),
  display: "flex",
  alignItems: "flex-start",
  width: "100%",
  marginBottom: theme.spacing(1),
  position: "relative",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    "& .message-tools": {
      opacity: 1,
    },
  },
}));

const MessageTools = styled(Box)(({ theme }) => ({
  position: "absolute",
  right: theme.spacing(1),
  top: theme.spacing(0.5),
  opacity: 0,
  transition: "opacity 0.2s ease-in-out",
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(0.5),
  boxShadow: theme.shadows[2],
  display: "flex",
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.25),
}));

function MessageComponent({ message }: MessageProps) {
  const { data: author } = useGetUserByIdWithCacheQuery(message.authorId);
  const { data: currentUser } = useProfileQuery();
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const isOwnMessage = currentUser?.id === message.authorId;

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

  const handleDeleteClick = async () => {
    if (!message.channelId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this message?"
    );
    if (!confirmed) return;

    try {
      await deleteMessage({
        id: message.id,
        channelId: message.channelId,
      }).unwrap();
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  return (
    <Container>
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
          <Typography variant="body1">
            {message.spans.map((span, idx) => renderSpan(span, idx))}
          </Typography>
        )}
      </div>
      {isOwnMessage && !isEditing && (
        <MessageTools className="message-tools">
          <IconButton size="small" onClick={handleEditClick}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={handleDeleteClick} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </MessageTools>
      )}
    </Container>
  );
}

export default MessageComponent;
