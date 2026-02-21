/**
 * MessageInput Component
 *
 * Unified message input for both channel and DM contexts.
 * Uses server-backed mention autocomplete for channels (with alias groups)
 * and simple local filtering for DMs.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, IconButton, CircularProgress } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { StyledPaper, StyledTextField } from "./MessageInputStyles";
import { FilePreview } from "./FilePreview";
import { MentionDropdown } from "./MentionDropdown";
import { useFileAttachments } from "./useFileAttachments";
import { useDropZone } from "./useDropZone";
import { DropZoneOverlay } from "./DropZoneOverlay";
import { useMentionHandling } from "./useMentionHandling";
import type { MentionSuggestion } from "./useMentionHandling";
import { useMentionAutocomplete } from "../../hooks/useMentionAutocomplete";
import {
  parseMessageWithMentions,
  getCurrentMention,
  insertMention,
} from "../../utils/mentionParser";
import type {
  UserMention,
  ChannelMention,
  AliasMention,
} from "../../utils/mentionParser";
import { useQuery } from "@tanstack/react-query";
import { aliasGroupsControllerGetCommunityAliasGroupsOptions } from "../../api-client/@tanstack/react-query.gen";
import { logger } from "../../utils/logger";
import { ACCEPTED_FILE_TYPES } from "../../constants/messages";
import { useNotification } from "../../contexts/NotificationContext";
import { useTypingEmitter } from "../../hooks/useTypingEmitter";
import type { Span } from "../../types/message.type";
import { SpanType } from "../../types/message.type";

export interface MessageInputProps {
  contextType: 'channel' | 'dm';
  contextId: string;
  userMentions: UserMention[];
  channelMentions?: ChannelMention[];
  onSendMessage: (messageContent: string, spans: Span[], files?: File[]) => void;
  placeholder?: string;
  communityId?: string;
}

// --- Local mention state for DM context ---
interface SimpleMentionState {
  isOpen: boolean;
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  query: string;
  type: 'user' | 'special' | null;
  isLoading: boolean;
}

export default function MessageInput({
  contextType,
  contextId,
  userMentions,
  channelMentions = [],
  onSendMessage,
  placeholder = "Type a message...",
  communityId,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showNotification } = useNotification();

  // Typing indicator emitter
  const { handleKeyPress: emitTypingKeyPress, sendTypingStop } = useTypingEmitter(
    contextType === 'channel'
      ? { channelId: contextId }
      : { directMessageGroupId: contextId },
  );

  const isChannel = contextType === 'channel' && !!communityId;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // --- File attachments ---
  const {
    selectedFiles,
    filePreviews,
    fileInputRef,
    handleFileSelect,
    handleFileDrop,
    handleRemoveFile,
    handleFileButtonClick,
    clearFiles,
    validationError,
    clearValidationError,
  } = useFileAttachments();

  const { isDragOver, dropZoneProps } = useDropZone({ onDrop: handleFileDrop });

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        handleFileDrop(files);
      }
    },
    [handleFileDrop]
  );

  useEffect(() => {
    if (validationError) {
      showNotification(validationError, "error");
      clearValidationError();
    }
  }, [validationError, showNotification, clearValidationError]);

  // --- Cursor tracking ---
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

  // --- Mention system: server-backed (channels) or local (DMs) ---
  const mentionHook = useMentionAutocomplete({
    communityId: communityId || '',
    text,
    cursorPosition,
  });

  // Alias groups (channel only)
  const { data: aliasGroups = [] } = useQuery({
    ...aliasGroupsControllerGetCommunityAliasGroupsOptions({ path: { communityId: communityId || '' } }),
    enabled: isChannel,
  });

  const aliasMentions: AliasMention[] = isChannel
    ? aliasGroups.map(group => ({ id: group.id, name: group.name }))
    : [];

  // Local mention state for DMs
  const [dmMentionState, setDmMentionState] = useState<SimpleMentionState>({
    isOpen: false,
    suggestions: [],
    selectedIndex: 0,
    query: "",
    type: null,
    isLoading: false,
  });

  const closeDmMentions = useCallback(() => {
    setDmMentionState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleDmInsertMention = useCallback(
    (mention: MentionSuggestion) => {
      insertMentionUtil(mention, text, setText, closeDmMentions);
    },
    [insertMentionUtil, text, closeDmMentions]
  );

  // DM mention detection
  useEffect(() => {
    if (isChannel) return;

    const currentMention = getCurrentMention(text, cursorPosition);
    if (currentMention && currentMention.query) {
      const filteredUsers = userMentions.filter(user =>
        (user.displayName || user.username).toLowerCase().includes(currentMention.query.toLowerCase())
      );

      setDmMentionState(prev => {
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
      setDmMentionState(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
    }
  }, [text, cursorPosition, userMentions, isChannel]);

  // --- Unified mention state ---
  const mentionIsOpen = isChannel ? mentionHook.state.isOpen : dmMentionState.isOpen;
  const mentionSuggestions = isChannel ? mentionHook.state.suggestions : dmMentionState.suggestions;
  const mentionSelectedIndex = isChannel ? mentionHook.state.selectedIndex : dmMentionState.selectedIndex;
  const mentionIsLoading = isChannel ? mentionHook.state.isLoading : dmMentionState.isLoading;

  // --- Mention selection handlers ---
  const handleMentionSelect = (index: number) => {
    if (isChannel) {
      const selectedSuggestion = mentionHook.state.suggestions[index];
      if (!selectedSuggestion) return;

      const mentionData = {
        type: selectedSuggestion.type,
        username: selectedSuggestion.type === "user" ? selectedSuggestion.displayName : undefined,
        specialKind: selectedSuggestion.type === "special" ? selectedSuggestion.displayName : undefined,
        aliasName: selectedSuggestion.type === "alias" ? selectedSuggestion.displayName : undefined,
      };

      const result = insertMention(text, cursorPosition, mentionData);
      setText(result.newText);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
        }
        timeoutRef.current = null;
      }, 0);

      mentionHook.close();
    } else {
      const selectedSuggestion = dmMentionState.suggestions[index];
      if (selectedSuggestion) {
        handleDmInsertMention(selectedSuggestion);
      }
    }
  };

  // --- DM mention keyboard handling ---
  const handleDmMentionKeyDown = (event: KeyboardEvent): boolean => {
    if (!dmMentionState.isOpen) return false;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        setDmMentionState(prev => ({
          ...prev,
          selectedIndex: Math.max(0, prev.selectedIndex - 1)
        }));
        return true;
      case 'ArrowDown':
        event.preventDefault();
        setDmMentionState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.suggestions.length - 1, prev.selectedIndex + 1)
        }));
        return true;
      case 'Tab':
      case 'Enter': {
        event.preventDefault();
        const selected = dmMentionState.suggestions[dmMentionState.selectedIndex];
        if (selected) {
          handleDmInsertMention(selected);
        }
        return true;
      }
      case 'Escape':
        event.preventDefault();
        closeDmMentions();
        return true;
      default:
        return false;
    }
  };

  // --- Send handler ---
  const handleSend = async () => {
    if ((!text || !text.trim()) && selectedFiles.length === 0) return;
    if (sending) return;

    setSending(true);
    try {
      const messageText = text.trim() || "";
      let spans = parseMessageWithMentions(messageText, userMentions, channelMentions, aliasMentions);

      if (spans.length === 0) {
        spans = [{ type: SpanType.PLAINTEXT, text: '' }];
      }

      await onSendMessage(messageText, spans, selectedFiles);
      sendTypingStop();
      setText("");
      clearFiles();
      if (isChannel) {
        mentionHook.close();
      } else {
        closeDmMentions();
      }

      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
    } catch (error) {
      logger.error("Failed to send message:", error);
      showNotification("Failed to send message. Please try again.", "error");
    } finally {
      setSending(false);
    }
  };

  // --- Keyboard handler ---
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (isChannel) {
      if (mentionHook.state.isOpen && mentionHook.handleKeyDown(event.nativeEvent)) {
        if (event.key === "Enter" || event.key === "Tab") {
          const selectedSuggestion = mentionHook.getSelectedSuggestion();
          if (selectedSuggestion) {
            handleMentionSelect(mentionHook.state.selectedIndex);
          }
        }
        return;
      }
    } else {
      if (dmMentionState.isOpen && handleDmMentionKeyDown(event.nativeEvent)) {
        if (event.key === "Enter" || event.key === "Tab") {
          const selected = dmMentionState.suggestions[dmMentionState.selectedIndex];
          if (selected) {
            handleMentionSelect(dmMentionState.selectedIndex);
          }
        }
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ position: "relative", width: "100%" }} {...dropZoneProps}>
      <DropZoneOverlay visible={isDragOver} />
      {mentionIsOpen && (
        <MentionDropdown
          suggestions={mentionSuggestions}
          selectedIndex={mentionSelectedIndex}
          isLoading={mentionIsLoading}
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
            onChange={(e) => {
              setText(e.target.value);
              emitTypingKeyPress();
            }}
            onKeyDown={handleKeyPress}
            onPaste={handlePaste}
            onClick={updateCursorPosition}
            onSelect={updateCursorPosition}
            sx={{ flex: 1 }}
            inputRef={inputRef}
            autoComplete="off"
            multiline
            maxRows={4}
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
}
