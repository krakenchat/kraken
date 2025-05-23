import { useState } from "react";
import {
  Box,
  Paper,
  TextField,
  IconButton,
  CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { styled } from "@mui/material/styles";
import { SpanType } from "../../types/message.type";
import {
  useSendMessageSocket,
  NewMessagePayload,
} from "../../hooks/useSendMessageSocket";

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  background: theme.palette.background.paper,
}));

interface MessageInputProps {
  channelId: string;
  authorId: string;
}

export default function MessageInput({
  channelId,
  authorId,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const sendMessage = useSendMessageSocket(() => setSending(false));

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const msg: NewMessagePayload = {
      channelId,
      authorId,
      spans: [{ type: SpanType.PLAINTEXT, text }],
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    };
    sendMessage(msg);
    setText("");
    // Wait for ack via ws before re-enabling
    setTimeout(() => setSending(false), 2000); // fallback
  };

  return (
    <Box sx={{ width: "100%" }}>
      <StyledPaper elevation={2}>
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
          sx={{ flex: 1 }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={sending || !text.trim()}
          aria-label="send"
        >
          {sending ? <CircularProgress size={24} /> : <SendIcon />}
        </IconButton>
      </StyledPaper>
    </Box>
  );
}
