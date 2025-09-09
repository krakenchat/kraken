import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, Paper, IconButton, CircularProgress } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { styled } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import { MentionDropdown } from "../Message/MentionDropdown";
import {
  parseMessageWithMentions,
  insertMention,
  UserMention,
  getCurrentMention,
} from "../../utils/mentionParser";
import { useGetDmGroupQuery } from "../../features/directMessages/directMessagesApiSlice";

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

interface DirectMessageInputProps {
  dmGroupId: string;
  onSendMessage: (messageContent: string, spans: any[]) => void;
  placeholder?: string;
}

export default function DirectMessageInput({
  dmGroupId,
  onSendMessage,
  placeholder = "Type a message...",
}: DirectMessageInputProps) {
  const [text, setText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get DM group info to get members for mentions
  const { data: dmGroup } = useGetDmGroupQuery(dmGroupId);

  // Convert DM group members to mention format (memoized to prevent infinite re-renders)
  const userMentions: UserMention[] = React.useMemo(() => {
    return dmGroup?.members?.map((member) => ({
      id: member.user.id,
      username: member.user.username,
      displayName: member.user.displayName || undefined,
    })) || [];
  }, [dmGroup?.members]);

  // For now, let's implement a simple mention state for DMs
  const [mentionState, setMentionState] = useState({
    isOpen: false,
    suggestions: [] as any[],
    selectedIndex: 0,
    query: "",
    type: null as 'user' | 'special' | null,
    isLoading: false,
  });

  // Simple mention detection for DMs
  useEffect(() => {
    const currentMention = getCurrentMention(text, cursorPosition);
    if (currentMention && currentMention.query) {
      const filteredUsers = userMentions.filter(user => 
        (user.displayName || user.username).toLowerCase().includes(currentMention.query.toLowerCase())
      );
      
      setMentionState(prev => {
        // Only update if something actually changed to prevent unnecessary re-renders
        const newSuggestions = filteredUsers.map(user => ({
          id: user.id,
          type: 'user' as const,
          displayName: user.displayName || user.username,
          subtitle: user.username !== user.displayName ? `@${user.username}` : undefined,
          username: user.username,
        }));
        
        const shouldOpen = filteredUsers.length > 0;
        if (prev.isOpen === shouldOpen && 
            prev.query === currentMention.query && 
            JSON.stringify(prev.suggestions) === JSON.stringify(newSuggestions)) {
          return prev; // No change needed
        }
        
        return {
          isOpen: shouldOpen,
          suggestions: newSuggestions,
          selectedIndex: 0,
          query: currentMention.query,
          type: 'user' as const,
          isLoading: false,
        };
      });
    } else {
      setMentionState(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
    }
  }, [text, cursorPosition, userMentions]);

  const selectSuggestion = useCallback(() => {
    if (mentionState.isOpen && mentionState.suggestions[mentionState.selectedIndex]) {
      return mentionState.suggestions[mentionState.selectedIndex];
    }
    return null;
  }, [mentionState]);

  const getSelectedSuggestion = useCallback(() => {
    return mentionState.suggestions[mentionState.selectedIndex] || null;
  }, [mentionState]);

  const closeMentions = useCallback(() => {
    setMentionState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleInsertMention = useCallback(
    (mention: any) => {
      if (!inputRef.current) return;

      setMentionState(prevState => {
        const newText = insertMention(
          text,
          cursorPosition,
          prevState.query || "",
          `@${mention.displayName || mention.username}`
        );

        setText(newText);

        // Focus and set cursor position after state updates
        requestAnimationFrame(() => {
          if (inputRef.current) {
            const newCursorPos = cursorPosition + `@${mention.displayName || mention.username}`.length - (prevState.query?.length || 0);
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            setCursorPosition(newCursorPos);
          }
        });

        return { ...prevState, isOpen: false };
      });
    },
    [text, cursorPosition]
  );

  const handleMentionKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!mentionState.isOpen) return false;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        setMentionState(prev => ({
          ...prev,
          selectedIndex: Math.max(0, prev.selectedIndex - 1)
        }));
        return true;
      case 'ArrowDown':
        event.preventDefault();
        setMentionState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.suggestions.length - 1, prev.selectedIndex + 1)
        }));
        return true;
      case 'Tab':
      case 'Enter':
        event.preventDefault();
        const selected = selectSuggestion();
        if (selected) {
          handleInsertMention(selected);
        }
        return true;
      case 'Escape':
        event.preventDefault();
        closeMentions();
        return true;
      default:
        return false;
    }
  }, [mentionState, selectSuggestion, handleInsertMention]);

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

    input.addEventListener("selectionchange", updateCursorPosition);
    input.addEventListener("click", updateCursorPosition);
    input.addEventListener("keyup", updateCursorPosition);

    return () => {
      input.removeEventListener("selectionchange", updateCursorPosition);
      input.removeEventListener("click", updateCursorPosition);
      input.removeEventListener("keyup", updateCursorPosition);
    };
  }, [updateCursorPosition]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;

    console.log("[DirectMessageInput] Sending message:", text);
    setSending(true);
    try {
      const spans = parseMessageWithMentions(text, userMentions, []);
      console.log("[DirectMessageInput] Parsed spans:", spans);
      console.log("[DirectMessageInput] Calling onSendMessage...");
      await onSendMessage(text, spans);
      setText("");
      setMentionState(prev => ({ ...prev, isOpen: false }));
      console.log("[DirectMessageInput] Message sent successfully");
    } catch (error) {
      console.error("[DirectMessageInput] Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    // Handle mention navigation first
    if (mentionState.isOpen && handleMentionKeyDown(event)) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };


  const handleMentionSelect = (mention: any) => {
    if (mention.username) {
      // User mention
      handleInsertMention(mention);
    }
  };

  return (
    <Box sx={{ position: "relative" }}>
      {mentionState.isOpen && (
        <MentionDropdown
          mentionState={mentionState}
          onSelect={handleMentionSelect}
          getSelectedSuggestion={getSelectedSuggestion}
        />
      )}
      <StyledPaper elevation={1}>
        <StyledTextField
          inputRef={inputRef}
          fullWidth
          variant="outlined"
          size="small"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyPress}
          multiline
          maxRows={4}
          disabled={sending}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          size="small"
        >
          {sending ? <CircularProgress size={20} /> : <SendIcon />}
        </IconButton>
      </StyledPaper>
    </Box>
  );
}