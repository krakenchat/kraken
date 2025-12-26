/**
 * ThreadMessageInput Component
 *
 * Input for composing thread reply messages.
 * Uses WebSocket to send messages in real-time.
 */

import React, { useState, useContext } from "react";
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useTheme } from "@mui/material/styles";
import { SocketContext } from "../../utils/SocketContext";
import { ClientEvents } from "../../types/client-events.enum";
import { SpanType } from "../../types/message.type";

interface ThreadMessageInputProps {
  parentMessageId: string;
  channelId?: string;
  directMessageGroupId?: string;
}

export const ThreadMessageInput: React.FC<ThreadMessageInputProps> = ({
  parentMessageId,
  channelId: _channelId,
  directMessageGroupId: _directMessageGroupId,
}) => {
  const theme = useTheme();
  const socket = useContext(SocketContext);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isSending) return;

    setIsSending(true);

    if (!socket?.connected) {
      console.error("Socket not connected");
      setIsSending(false);
      return;
    }

    const payload = {
      parentMessageId,
      spans: [
        {
          type: SpanType.PLAINTEXT,
          text: trimmedContent,
          userId: null,
          specialKind: null,
          channelId: null,
          communityId: null,
          aliasId: null,
        },
      ],
      attachments: [],
      pendingAttachments: 0,
    };

    socket.emit(ClientEvents.SEND_THREAD_REPLY, payload, (response: string | { error: string }) => {
      setIsSending(false);
      if (typeof response === "string") {
        // Success - response is the message ID
        setContent("");
      } else if (response?.error) {
        console.error("Failed to send thread reply:", response.error);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        borderTop: 1,
        borderColor: "divider",
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Reply..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
            },
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!content.trim() || isSending}
          sx={{
            width: 40,
            height: 40,
          }}
        >
          {isSending ? (
            <CircularProgress size={20} />
          ) : (
            <SendIcon />
          )}
        </IconButton>
      </Box>
    </Box>
  );
};

export default ThreadMessageInput;
