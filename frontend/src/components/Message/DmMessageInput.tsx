/**
 * DmMessageInput Component
 *
 * Message input component for direct message contexts.
 * Uses simple mention autocomplete for conversation participants.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, IconButton, CircularProgress } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { StyledPaper, StyledTextField } from "./MessageInputStyles";
import { FilePreview } from "./FilePreview";
import { MentionDropdown } from "./MentionDropdown";
import { useFileAttachments } from "./useFileAttachments";
import { useMentionHandling, MentionSuggestion } from "./useMentionHandling";
import {
  parseMessageWithMentions,
  UserMention,
  getCurrentMention,
} from "../../utils/mentionParser";
import { logger } from "../../utils/logger";
import { ACCEPTED_FILE_TYPES } from "../../constants/messages";

export interface DmMessageInputProps {
  userMentions: UserMention[];
  onSendMessage: (messageContent: string, spans: unknown[], files?: File[]) => void;
  placeholder?: string;
}

interface SimpleMentionState {
  isOpen: boolean;
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  query: string;
  type: 'user' | 'special' | null;
  isLoading: boolean;
}

export const DmMessageInput: React.FC<DmMessageInputProps> = ({
  userMentions,
  onSendMessage,
  placeholder = "Type a message...",
}) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [mentionState, setMentionState] = useState<SimpleMentionState>({
    isOpen: false,
    suggestions: [],
    selectedIndex: 0,
    query: "",
    type: null,
    isLoading: false,
  });

  const {
    selectedFiles,
    filePreviews,
    fileInputRef,
    handleFileSelect,
    handleRemoveFile,
    handleFileButtonClick,
    clearFiles,
  } = useFileAttachments();

  const {
    cursorPosition,
    updateCursorPosition,
    handleInsertMention: insertMentionUtil,
    setupCursorTracking,
  } = useMentionHandling();

  useEffect(() => {
    setupCursorTracking(inputRef);
  }, [setupCursorTracking]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const closeMentions = useCallback(() => {
    setMentionState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleInsertMention = useCallback(
    (mention: MentionSuggestion) => {
      insertMentionUtil(mention, text, setText, closeMentions);
    },
    [insertMentionUtil, text, closeMentions]
  );

  // Simple mention detection for DMs
  useEffect(() => {
    const currentMention = getCurrentMention(text, cursorPosition);
    if (currentMention && currentMention.query) {
      const filteredUsers = userMentions.filter(user =>
        (user.displayName || user.username).toLowerCase().includes(currentMention.query.toLowerCase())
      );

      setMentionState(prev => {
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
      setMentionState(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
    }
  }, [text, cursorPosition, userMentions]);

  const handleMentionKeyDown = (event: KeyboardEvent): boolean => {
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
      case 'Enter': {
        event.preventDefault();
        const selected = mentionState.suggestions[mentionState.selectedIndex];
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

  const handleMentionSelect = (index: number) => {
    const selectedSuggestion = mentionState.suggestions[index];
    if (selectedSuggestion) {
      handleInsertMention(selectedSuggestion);
    }
  };

  const handleSend = async () => {
    if ((!text || !text.trim()) && selectedFiles.length === 0) return;
    if (sending) return;

    setSending(true);
    try {
      const messageText = text.trim() || "";
      let spans = parseMessageWithMentions(messageText, userMentions, []);

      // Backend requires at least one span, so add empty PLAINTEXT if needed
      if (spans.length === 0) {
        spans = [{ type: 'PLAINTEXT', text: '' }];
      }

      await onSendMessage(messageText, spans, selectedFiles);
      setText("");
      clearFiles();
      closeMentions();

      // Refocus the input after sending message
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
    } catch (error) {
      logger.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    // Handle mention navigation first
    if (mentionState.isOpen && handleMentionKeyDown(event.nativeEvent)) {
      if (event.key === "Enter" || event.key === "Tab") {
        const selectedSuggestion = mentionState.suggestions[mentionState.selectedIndex];
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
        />
      )}

      <FilePreview
        files={selectedFiles}
        previews={filePreviews}
        onRemoveFile={handleRemoveFile}
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleFileSelect}
      />

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
          onClick={handleFileButtonClick}
          disabled={sending}
          size="small"
          aria-label="attach file"
        >
          <AttachFileIcon />
        </IconButton>
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={sending || ((!text || !text.trim()) && selectedFiles.length === 0)}
          size="small"
        >
          {sending ? <CircularProgress size={20} /> : <SendIcon />}
        </IconButton>
      </StyledPaper>
    </Box>
  );
};
