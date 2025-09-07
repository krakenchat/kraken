import { useState, useRef, useEffect, useCallback } from "react";
import { Box, Paper, IconButton, CircularProgress } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { styled } from "@mui/material/styles";
import {
  useSendMessageSocket,
  NewMessagePayload,
} from "../../hooks/useSendMessageSocket";
import TextField from "@mui/material/TextField";
import { useMentionAutocomplete } from "../../hooks/useMentionAutocomplete";
import { MentionDropdown } from "./MentionDropdown";
import {
  parseMessageWithMentions,
  insertMention,
  UserMention,
  ChannelMention,
} from "../../utils/mentionParser";
import { useGetMembersForCommunityQuery } from "../../features/membership/membershipApiSlice";
import { useGetMentionableChannelsQuery } from "../../features/channel/channelApiSlice";

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
  communityId: string;
}

export default function MessageInput({
  channelId,
  authorId,
  communityId,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessageSocket(() => setSending(false));

  // Fetch community members and channels for mention resolution
  const { data: memberData = [] } = useGetMembersForCommunityQuery(communityId);
  const { data: channelData = [] } =
    useGetMentionableChannelsQuery(communityId);

  // Convert to mention format
  const userMentions: UserMention[] = memberData.map((member) => ({
    id: member.user!.id,
    username: member.user!.username,
    displayName: member.user!.displayName || undefined,
  }));

  const channelMentions: ChannelMention[] = channelData.map((channel) => ({
    id: channel.id,
    name: channel.name,
  }));

  // Mention autocomplete
  const {
    state: mentionState,
    selectSuggestion,
    getSelectedSuggestion,
    close: closeMentions,
    handleKeyDown: handleMentionKeyDown,
  } = useMentionAutocomplete({
    communityId,
    text,
    cursorPosition,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Update cursor position when input changes
  const updateCursorPosition = useCallback(() => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart || 0);
    }
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleSelectionChange = () => {
      updateCursorPosition();
    };

    input.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      input.removeEventListener("selectionchange", handleSelectionChange);
  }, [updateCursorPosition]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setText(event.target.value);
      updateCursorPosition();
    },
    [updateCursorPosition]
  );

  const handleClick = useCallback(() => {
    updateCursorPosition();
  }, [updateCursorPosition]);

  const handleMentionSelect = useCallback(
    (index: number) => {
      selectSuggestion(index);
      const selectedSuggestion = mentionState.suggestions[index];
      if (selectedSuggestion) {
        const mentionData = {
          type: selectedSuggestion.type,
          username:
            selectedSuggestion.type === "user"
              ? selectedSuggestion.displayName
              : undefined,
          name:
            selectedSuggestion.type === "channel"
              ? selectedSuggestion.displayName
              : undefined,
        };

        const result = insertMention(text, cursorPosition, mentionData);
        setText(result.newText);

        // Update cursor position after state update
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(
              result.newCursorPosition,
              result.newCursorPosition
            );
          }
        }, 0);

        closeMentions();
      }
    },
    [
      selectSuggestion,
      mentionState.suggestions,
      text,
      cursorPosition,
      closeMentions,
    ]
  );

  const handleSend = useCallback(async () => {
    if (!text.trim()) return;
    setSending(true);

    // Parse text with mentions to create spans
    const spans = parseMessageWithMentions(text, userMentions, channelMentions);

    const msg: NewMessagePayload = {
      channelId,
      authorId,
      spans,
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    };

    sendMessage(msg);
    setText("");
    setCursorPosition(0);
    closeMentions();

    // Wait for ack via ws before re-enabling
    setTimeout(() => {
      setSending(false);
    }, 2000); // fallback
  }, [
    authorId,
    channelId,
    channelMentions,
    closeMentions,
    sendMessage,
    text,
    userMentions,
  ]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Let mention autocomplete handle its keys first
      if (handleMentionKeyDown(event.nativeEvent)) {
        if (event.key === "Enter" || event.key === "Tab") {
          // Handle mention selection
          const selectedSuggestion = getSelectedSuggestion();
          if (selectedSuggestion) {
            const mentionData = {
              type: selectedSuggestion.type,
              username:
                selectedSuggestion.type === "user"
                  ? selectedSuggestion.displayName
                  : undefined,
              name:
                selectedSuggestion.type === "channel"
                  ? selectedSuggestion.displayName
                  : undefined,
            };

            const result = insertMention(text, cursorPosition, mentionData);
            setText(result.newText);

            // Update cursor position after state update
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.setSelectionRange(
                  result.newCursorPosition,
                  result.newCursorPosition
                );
              }
            }, 0);

            closeMentions();
          }
        }
        return;
      }

      // Handle regular Enter for sending
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [
      handleMentionKeyDown,
      getSelectedSuggestion,
      handleSend,
      text,
      cursorPosition,
      closeMentions,
    ]
  );

  return (
    <Box sx={{ width: "100%", position: "relative" }}>
      {/* Mention Dropdown */}
      {mentionState.isOpen && (
        <MentionDropdown
          suggestions={mentionState.suggestions}
          selectedIndex={mentionState.selectedIndex}
          isLoading={mentionState.isLoading}
          onSelectSuggestion={handleMentionSelect}
          position={{ bottom: 80, left: 20 }}
        />
      )}

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
            placeholder="Type a message... Use @ for members, # for channels"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onClick={handleClick}
            onSelect={updateCursorPosition}
            sx={{ flex: 1 }}
            inputRef={inputRef}
            autoComplete="off"
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
