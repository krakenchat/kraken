import { useState, useRef, useEffect } from "react";
import { Box, Paper, IconButton, CircularProgress } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { styled } from "@mui/material/styles";
import { SpanType } from "../../types/message.type";
import {
  useSendMessageSocket,
  NewMessagePayload,
} from "../../hooks/useSendMessageSocket";
import TextField from "@mui/material/TextField";

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  background: theme.palette.background.paper,
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.palette.divider,
  },
  "& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.palette.primary.main,
  },
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
  const inputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessageSocket(() => setSending(false));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    setTimeout(() => {
      setSending(false);
    }, 2000); // fallback
  };

  return (
    <Box sx={{ width: "100%" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{ width: "100%" }}
      >
        <StyledPaper elevation={2}>
          <StyledTextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            sx={{ flex: 1 }}
            inputRef={inputRef}
          />
          <IconButton
            color="primary"
            type="submit"
            disabled={sending || !text.trim()}
            aria-label="send"
          >
            {sending ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </StyledPaper>
      </form>
    </Box>
  );
}
