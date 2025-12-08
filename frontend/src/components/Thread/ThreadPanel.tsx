/**
 * ThreadPanel Component
 *
 * Side panel showing a thread's parent message and replies.
 * Users can read and add replies to the thread.
 */

import React, { useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  Skeleton,
  Alert,
  Divider,
  Button,
  Tooltip,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import { useDispatch, useSelector } from "react-redux";
import {
  useLazyGetThreadRepliesQuery,
  useSubscribeToThreadMutation,
  useUnsubscribeFromThreadMutation,
} from "../../features/threads/threadsApiSlice";
import {
  selectThreadReplies,
  selectThreadLoading,
  selectThreadContinuationToken,
  selectIsSubscribed,
  selectThreadLoaded,
  closeThread,
} from "../../features/threads/threadsSlice";
import { Message } from "../../types/message.type";
import MessageComponent from "../Message/MessageComponent";
import ThreadMessageInput from "./ThreadMessageInput";

interface ThreadPanelProps {
  parentMessage: Message;
  channelId?: string;
  directMessageGroupId?: string;
  communityId?: string;
}

export const ThreadPanel: React.FC<ThreadPanelProps> = ({
  parentMessage,
  channelId,
  directMessageGroupId,
  communityId,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const parentMessageId = parentMessage.id;

  const replies = useSelector(selectThreadReplies(parentMessageId));
  const isLoading = useSelector(selectThreadLoading(parentMessageId));
  const isLoaded = useSelector(selectThreadLoaded(parentMessageId));
  const continuationToken = useSelector(selectThreadContinuationToken(parentMessageId));
  const isSubscribed = useSelector(selectIsSubscribed(parentMessageId));

  const [fetchReplies] = useLazyGetThreadRepliesQuery();
  const [subscribe] = useSubscribeToThreadMutation();
  const [unsubscribe] = useUnsubscribeFromThreadMutation();

  // Load initial replies (only once per thread)
  useEffect(() => {
    if (!isLoaded && !isLoading) {
      fetchReplies({ parentMessageId });
    }
  }, [parentMessageId, isLoaded, isLoading, fetchReplies]);

  // Scroll to bottom when new replies come in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies.length]);

  const handleClose = () => {
    dispatch(closeThread());
  };

  const handleLoadMore = useCallback(() => {
    if (continuationToken && !isLoading) {
      fetchReplies({ parentMessageId, continuationToken });
    }
  }, [continuationToken, isLoading, fetchReplies, parentMessageId]);

  const handleToggleSubscription = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe(parentMessageId).unwrap();
      } else {
        await subscribe(parentMessageId).unwrap();
      }
    } catch (err) {
      console.error("Failed to toggle subscription:", err);
    }
  };

  const contextId = channelId || directMessageGroupId || "";

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.palette.background.default,
        borderLeft: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ChatBubbleOutlineIcon sx={{ color: "primary.main" }} />
          <Typography variant="h6">Thread</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title={isSubscribed ? "Turn off notifications" : "Get notified about replies"}>
            <IconButton size="small" onClick={handleToggleSubscription}>
              {isSubscribed ? (
                <NotificationsIcon fontSize="small" color="primary" />
              ) : (
                <NotificationsOffIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Parent Message */}
      <Box
        sx={{
          p: 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
          Original message
        </Typography>
        <MessageComponent
          message={parentMessage}
          contextId={contextId}
          communityId={communityId}
          isThreadParent
        />
      </Box>

      {/* Replies */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 1,
        }}
      >
        {/* Load more button */}
        {continuationToken && (
          <Box sx={{ textAlign: "center", py: 1 }}>
            <Button
              size="small"
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              Load earlier replies
            </Button>
          </Box>
        )}

        {/* Loading state */}
        {isLoading && replies.length === 0 && (
          <Box sx={{ p: 2 }}>
            {[1, 2, 3].map((i) => (
              <Box key={i} sx={{ mb: 2 }}>
                <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
              </Box>
            ))}
          </Box>
        )}

        {/* No replies state */}
        {!isLoading && replies.length === 0 && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 4,
              px: 2,
            }}
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No replies yet
            </Typography>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              Be the first to reply to this message
            </Typography>
          </Box>
        )}

        {/* Replies list */}
        {replies.map((reply, index) => (
          <React.Fragment key={reply.id}>
            {index > 0 && <Divider sx={{ my: 1 }} />}
            <MessageComponent
              message={reply}
              contextId={contextId}
              communityId={communityId}
              isThreadReply
            />
          </React.Fragment>
        ))}

        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <ThreadMessageInput
        parentMessageId={parentMessageId}
        channelId={channelId}
        directMessageGroupId={directMessageGroupId}
      />
    </Box>
  );
};

export default ThreadPanel;
