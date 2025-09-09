import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Box, Paper, IconButton, CircularProgress } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { styled } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import { MentionDropdown } from "../Message/MentionDropdown";
import {
  parseMessageWithMentions,
  insertMention,
  UserMention,
  ChannelMention,
  getCurrentMention,
} from "../../utils/mentionParser";
import { useMentionAutocomplete } from "../../hooks/useMentionAutocomplete";

interface MentionSuggestion {
  id: string;
  type: 'user' | 'special';
  displayName: string;
  subtitle?: string;
  username?: string;
}

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

export interface MessageInputProps {
  contextType: 'channel' | 'dm';
  contextId: string;
  userMentions: UserMention[];
  channelMentions?: ChannelMention[];
  onSendMessage: (messageContent: string, spans: unknown[]) => void;
  placeholder?: string;
  communityId?: string; // For channels to use mention autocomplete
}

export default function MessageInput({
  contextType,
  userMentions,
  channelMentions = [],
  onSendMessage,
  placeholder = "Type a message...",
  communityId,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // For DMs, use simple mention state; for channels, use the advanced hook if provided
  const [simpleMentionState, setSimpleMentionState] = useState({
    isOpen: false,
    suggestions: [] as MentionSuggestion[],
    selectedIndex: 0,
    query: "",
    type: null as 'user' | 'special' | null,
    isLoading: false,
  });

  // Use mention autocomplete hook for channels - call unconditionally to follow Rules of Hooks
  const channelMentionHook = useMentionAutocomplete(
    contextType === 'channel' && communityId ? 
      { communityId, text, cursorPosition } : 
      { communityId: "", text: "", cursorPosition: 0 }
  );

  const isChannelMode = contextType === 'channel' && communityId;
  const mentionState = isChannelMode ? channelMentionHook.state : simpleMentionState;
  const selectSuggestion = isChannelMode ? channelMentionHook.selectSuggestion : 
    (index: number) => mentionState.suggestions[index] || null;
  const getSelectedSuggestion = isChannelMode ? channelMentionHook.getSelectedSuggestion :
    () => mentionState.suggestions[mentionState.selectedIndex] || null;
  const closeMentions = useMemo(() => 
    isChannelMode ? channelMentionHook.close :
      () => setSimpleMentionState(prev => ({ ...prev, isOpen: false })),
    [isChannelMode, channelMentionHook.close]
  );
  const handleMentionKeyDown = isChannelMode ? channelMentionHook.handleKeyDown :
    (event: KeyboardEvent) => {
      if (!mentionState.isOpen) return false;
      
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          setSimpleMentionState(prev => ({
            ...prev,
            selectedIndex: Math.max(0, prev.selectedIndex - 1)
          }));
          return true;
        case 'ArrowDown':
          event.preventDefault();
          setSimpleMentionState(prev => ({
            ...prev,
            selectedIndex: Math.min(prev.suggestions.length - 1, prev.selectedIndex + 1)
          }));
          return true;
        case 'Tab':
        case 'Enter': {
          event.preventDefault();
          const selected = selectSuggestion(mentionState.selectedIndex);
          if (selected) {
            handleInsertMention(selected);
          }
          return true;
        }
        case 'Escape':
          event.preventDefault();
          closeMentions();
          return true;
        default:
          return false;
      }
    };

  // Simple mention detection for DMs
  useEffect(() => {
    if (!isChannelMode) {
      const currentMention = getCurrentMention(text, cursorPosition);
      if (currentMention && currentMention.query) {
        const filteredUsers = userMentions.filter(user => 
          (user.displayName || user.username).toLowerCase().includes(currentMention.query.toLowerCase())
        );
        
        setSimpleMentionState(prev => {
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
            return prev;
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
        setSimpleMentionState(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
      }
    }
  }, [text, cursorPosition, userMentions, isChannelMode]);

  const handleInsertMention = useCallback(
    (mention: MentionSuggestion) => {
      if (!inputRef.current) return;

      const mentionData = isChannelMode ? {
        type: mention.type,
        username: mention.type === "user" ? mention.displayName : undefined,
        specialKind: mention.type === "special" ? mention.displayName : undefined,
      } : { 
        type: 'user', 
        username: mention.displayName || mention.username 
      };

      const result = insertMention(text, cursorPosition, mentionData);
      setText(result.newText);

      // Focus and set cursor position after state updates
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
          setCursorPosition(result.newCursorPosition);
        }
      });

      closeMentions();
    },
    [text, cursorPosition, isChannelMode, closeMentions]
  );

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
    if (!text || typeof text !== 'string' || !text.trim() || sending) return;

    setSending(true);
    try {
      const spans = parseMessageWithMentions(text, userMentions, channelMentions);
      await onSendMessage(text, spans);
      setText("");
      setSimpleMentionState(prev => ({ ...prev, isOpen: false }));
      closeMentions();
      
      // Refocus the input after sending message
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleMentionSelect = useCallback(
    (index: number) => {
      const selectedSuggestion = mentionState.suggestions[index];
      if (!selectedSuggestion) return;

      if (isChannelMode) {
        // Use the advanced hook's selection logic
        const mentionData = {
          type: selectedSuggestion.type,
          username: selectedSuggestion.type === "user" ? selectedSuggestion.displayName : undefined,
          specialKind: selectedSuggestion.type === "special" ? selectedSuggestion.displayName : undefined,
        };

        const result = insertMention(text, cursorPosition, mentionData);
        setText(result.newText);

        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
          }
        }, 0);

        closeMentions();
      } else {
        // Use simple DM selection logic
        handleInsertMention(selectedSuggestion);
      }
    },
    [mentionState.suggestions, isChannelMode, text, cursorPosition, handleInsertMention, closeMentions]
  );

  const handleKeyPress = (event: React.KeyboardEvent) => {
    // Handle mention navigation first
    if (mentionState.isOpen && handleMentionKeyDown(event.nativeEvent)) {
      if (event.key === "Enter" || event.key === "Tab") {
        // Handle mention selection
        const selectedSuggestion = getSelectedSuggestion();
        if (selectedSuggestion) {
          handleMentionSelect(mentionState.selectedIndex);
        }
      }
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      {mentionState.isOpen && (
        <MentionDropdown
          suggestions={mentionState.suggestions}
          selectedIndex={mentionState.selectedIndex}
          isLoading={mentionState.isLoading}
          onSelectSuggestion={handleMentionSelect}
          position={isChannelMode ? { bottom: 80, left: 20 } : undefined}
        />
      )}
      
      {isChannelMode ? (
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
              placeholder={placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyPress}
              onClick={updateCursorPosition}
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
      ) : (
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
            disabled={!text || typeof text !== 'string' || !text.trim() || sending}
            size="small"
          >
            {sending ? <CircularProgress size={20} /> : <SendIcon />}
          </IconButton>
        </StyledPaper>
      )}
    </Box>
  );
}