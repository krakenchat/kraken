/**
 * ChannelMessageInput Component
 *
 * Message input component for channel contexts.
 * Uses advanced mention autocomplete with community member search.
 */

import React, { useState, useRef, useEffect } from "react";
import { Box, IconButton, CircularProgress } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { StyledPaper, StyledTextField } from "./MessageInputStyles";
import { FilePreview } from "./FilePreview";
import { MentionDropdown } from "./MentionDropdown";
import { useFileAttachments } from "./useFileAttachments";
import { useMentionHandling } from "./useMentionHandling";
import { useMentionAutocomplete } from "../../hooks/useMentionAutocomplete";
import {
  parseMessageWithMentions,
  insertMention,
} from "../../utils/mentionParser";
import type {
  UserMention,
  ChannelMention,
} from "../../utils/mentionParser";
import { logger } from "../../utils/logger";
import { ACCEPTED_FILE_TYPES } from "../../constants/messages";
import type { Span } from "../../types/message.type";
import { SpanType } from "../../types/message.type";

export interface ChannelMessageInputProps {
  communityId: string;
  userMentions: UserMention[];
  channelMentions: ChannelMention[];
  onSendMessage: (messageContent: string, spans: Span[], files?: File[]) => void;
  placeholder?: string;
}

export const ChannelMessageInput: React.FC<ChannelMessageInputProps> = ({
  communityId,
  userMentions,
  channelMentions,
  onSendMessage,
  placeholder = "Type a message...",
}) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setupCursorTracking,
  } = useMentionHandling();

  const mentionHook = useMentionAutocomplete({
    communityId,
    text,
    cursorPosition,
  });

  useEffect(() => {
    setupCursorTracking(inputRef);
  }, [setupCursorTracking]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleMentionSelect = (index: number) => {
    const selectedSuggestion = mentionHook.state.suggestions[index];
    if (!selectedSuggestion) return;

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

    mentionHook.close();
  };

  const handleSend = async () => {
    if ((!text || !text.trim()) && selectedFiles.length === 0) return;
    if (sending) return;

    setSending(true);
    try {
      const messageText = text.trim() || "";
      let spans = parseMessageWithMentions(messageText, userMentions, channelMentions);

      // Backend requires at least one span, so add empty PLAINTEXT if needed
      if (spans.length === 0) {
        spans = [{ type: SpanType.PLAINTEXT, text: '' }];
      }

      await onSendMessage(messageText, spans, selectedFiles);
      setText("");
      clearFiles();
      mentionHook.close();

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
    if (mentionHook.state.isOpen && mentionHook.handleKeyDown(event.nativeEvent)) {
      if (event.key === "Enter" || event.key === "Tab") {
        const selectedSuggestion = mentionHook.getSelectedSuggestion();
        if (selectedSuggestion) {
          handleMentionSelect(mentionHook.state.selectedIndex);
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
      {mentionHook.state.isOpen && (
        <MentionDropdown
          suggestions={mentionHook.state.suggestions}
          selectedIndex={mentionHook.state.selectedIndex}
          isLoading={mentionHook.state.isLoading}
          onSelectSuggestion={handleMentionSelect}
          position={{ bottom: 80, left: 20 }}
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
            onClick={handleFileButtonClick}
            disabled={sending}
            aria-label="attach file"
          >
            <AttachFileIcon />
          </IconButton>
          <IconButton
            color="primary"
            type="submit"
            disabled={sending || ((!text || !text.trim()) && selectedFiles.length === 0)}
            aria-label="send"
          >
            {sending ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </StyledPaper>
      </form>
    </Box>
  );
};
