import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Box,
  TextField,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  IconButton,
  Popover,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { useQueryClient } from "@tanstack/react-query";
import {
  messagesControllerSearchChannelMessagesOptions,
  messagesControllerSearchCommunityMessagesOptions,
} from "../../api-client/@tanstack/react-query.gen";
import { Message } from "../../types/message.type";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "../../hooks/useDebounce";
import { logger } from "../../utils/logger";

type SearchScope = "channel" | "community";

interface MessageSearchProps {
  channelId: string;
  communityId: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

interface SearchResult extends Message {
  channelName?: string;
}

const MessageSearch: React.FC<MessageSearchProps> = ({
  channelId,
  communityId,
  anchorEl,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("channel");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const debouncedQuery = useDebounce(query, 300);
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const isOpen = Boolean(anchorEl);

  // Focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery || debouncedQuery.trim().length === 0) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        if (scope === "channel") {
          const data = await queryClient.fetchQuery(
            messagesControllerSearchChannelMessagesOptions({
              path: { channelId },
              query: { q: debouncedQuery, limit: 20 },
            })
          );
          setResults((data as SearchResult[]) || []);
        } else {
          const data = await queryClient.fetchQuery(
            messagesControllerSearchCommunityMessagesOptions({
              path: { communityId },
              query: { q: debouncedQuery, limit: 20 },
            })
          );
          setResults((data as SearchResult[]) || []);
        }
        setSelectedIndex(0);
      } catch (error) {
        logger.error("Search failed:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [
    debouncedQuery,
    scope,
    channelId,
    communityId,
    queryClient,
  ]);

  const handleScopeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newScope: SearchScope | null) => {
      if (newScope) {
        setScope(newScope);
        setResults([]);
      }
    },
    []
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      // Navigate to the channel/message with highlight param
      const targetChannelId = result.channelId;
      if (targetChannelId) {
        navigate(
          `/community/${communityId}/channel/${targetChannelId}?highlight=${result.id}`
        );
      }
      onClose();
    },
    [communityId, navigate, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleResultClick(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, handleResultClick, onClose]
  );

  const getMessagePreview = (result: SearchResult): string => {
    // Extract text from spans
    const text = result.spans
      .filter((span) => span.text)
      .map((span) => span.text)
      .join(" ");

    // Truncate to 100 chars
    return text.length > 100 ? text.substring(0, 100) + "..." : text;
  };

  return (
    <Popover
      open={isOpen}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      slotProps={{
        paper: {
          sx: {
            width: 400,
            maxHeight: 500,
            mt: 1,
          },
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* Search Input */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: query && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setQuery("")}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
        />

        {/* Scope Toggle */}
        <ToggleButtonGroup
          value={scope}
          exclusive
          onChange={handleScopeChange}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
        >
          <ToggleButton value="channel">This Channel</ToggleButton>
          <ToggleButton value="community">All Channels</ToggleButton>
        </ToggleButtonGroup>

        {/* Results */}
        <Box sx={{ maxHeight: 350, overflow: "auto" }}>
          {isLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!isLoading && query && results.length === 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", py: 2 }}
            >
              No messages found
            </Typography>
          )}

          {!isLoading && results.length > 0 && (
            <List disablePadding>
              {results.map((result, index) => (
                <ListItemButton
                  key={result.id}
                  selected={index === selectedIndex}
                  onClick={() => handleResultClick(result)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    "&.Mui-selected": {
                      backgroundColor: "action.selected",
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        {scope === "community" && result.channelName && (
                          <Typography
                            variant="caption"
                            sx={{
                              backgroundColor: "action.hover",
                              px: 0.75,
                              py: 0.25,
                              borderRadius: 0.5,
                            }}
                          >
                            #{result.channelName}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(new Date(result.sentAt), {
                            addSuffix: true,
                          })}
                        </Typography>
                      </Box>
                    }
                    secondary={getMessagePreview(result)}
                    secondaryTypographyProps={{
                      sx: {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}

          {!query && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", py: 2 }}
            >
              Type to search messages
            </Typography>
          )}
        </Box>
      </Box>
    </Popover>
  );
};

export default MessageSearch;
