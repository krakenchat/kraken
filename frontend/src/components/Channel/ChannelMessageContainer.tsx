import React, { useState, useCallback } from "react";
import { Box, Typography, Paper, IconButton, Tooltip, Badge, Drawer } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PushPinIcon from "@mui/icons-material/PushPin";
import MessageContainerWrapper from "../Message/MessageContainerWrapper";
import MemberListContainer from "../Message/MemberListContainer";
import MessageSearch from "../Message/MessageSearch";
import { PinnedMessagesPanel } from "../Moderation";
import { ThreadPanel } from "../Thread";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useChannelMessages } from "../../hooks/useChannelMessages";
import { useSendMessage } from "../../hooks/useSendMessage";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  membershipControllerFindAllForCommunityOptions,
  channelsControllerGetMentionableChannelsOptions,
  channelsControllerFindOneOptions,
} from "../../api-client/@tanstack/react-query.gen";
import {
  userControllerGetProfileOptions,
  moderationControllerGetPinnedMessagesOptions,
  messagesControllerAddAttachmentMutation,
} from "../../api-client/@tanstack/react-query.gen";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useNotification } from "../../contexts/NotificationContext";
import { channelMessagesQueryKey } from "../../utils/messageQueryKeys";
import { updateMessageInInfinite } from "../../utils/messageCacheUpdaters";
import ChannelNotificationMenu from "./ChannelNotificationMenu";
import { useAutoMarkNotificationsRead } from "../../hooks/useAutoMarkNotificationsRead";
import { useThreadPanel } from "../../contexts/ThreadPanelContext";
import { useVoice } from "../../contexts/VoiceContext";
import { VOICE_BAR_HEIGHT } from "../../constants/layout";
import type { UserMention, ChannelMention } from "../../utils/mentionParser";
import { logger } from "../../utils/logger";
import type { Message } from "../../types/message.type";

interface ChannelMessageContainerProps {
  channelId: string;
  /** Hide the built-in header (for mobile which has its own app bar) */
  hideHeader?: boolean;
  /** Optional communityId prop (for mobile where useParams is unavailable) */
  communityId?: string;
}

const ChannelMessageContainer: React.FC<ChannelMessageContainerProps> = ({
  channelId,
  hideHeader = false,
  communityId: communityIdProp,
}) => {
  const { data: user } = useQuery(userControllerGetProfileOptions());
  const authorId = user?.id || "";

  const { isConnected: voiceConnected } = useVoice();

  // Get communityId from props (mobile) or URL params (desktop)
  const { communityId: communityIdParam } = useParams<{
    communityId: string;
  }>();
  const communityId = communityIdProp || communityIdParam;

  // Get highlight message ID from URL params
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlightMessageId = searchParams.get("highlight");

  // Clear highlight param from URL after a delay (so the flash animation can play)
  React.useEffect(() => {
    if (highlightMessageId) {
      const timer = setTimeout(() => {
        navigate(`/community/${communityId}/channel/${channelId}`, {
          replace: true,
        });
      }, 3000); // Clear after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [highlightMessageId, communityId, channelId, navigate]);

  const queryClient = useQueryClient();

  const { uploadFile } = useFileUpload();
  const { mutateAsync: addAttachment } = useMutation({
    ...messagesControllerAddAttachmentMutation(),
    onSuccess: (updatedMessage) => {
      if (updatedMessage.channelId) {
        const queryKey = channelMessagesQueryKey(updatedMessage.channelId);
        queryClient.setQueryData(queryKey, (old: unknown) =>
          updateMessageInInfinite(old as never, updatedMessage as import("../../types/message.type").Message)
        );
      }
    },
  });
  const { showNotification } = useNotification();
  const pendingFilesRef = React.useRef<File[] | null>(null);

  // Search state
  const [searchAnchorEl, setSearchAnchorEl] = useState<HTMLElement | null>(null);
  const handleSearchOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSearchAnchorEl(event.currentTarget);
  };
  const handleSearchClose = () => {
    setSearchAnchorEl(null);
  };

  // Pinned messages state
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(false);
  const { data: pinnedMessages = [] } = useQuery(moderationControllerGetPinnedMessagesOptions({ path: { channelId } }));

  // Thread state
  const { openThreadId, openThread, closeThread } = useThreadPanel();
  const [threadParentMessage, setThreadParentMessage] = useState<Message | null>(null);

  const handleOpenThread = useCallback((message: Message) => {
    setThreadParentMessage(message);
    openThread(message.id);
  }, [openThread]);

  const handleCloseThread = useCallback(() => {
    closeThread();
    setThreadParentMessage(null);
  }, [closeThread]);

  // Fetch channel data for header
  const { data: channel } = useQuery(channelsControllerFindOneOptions({ path: { id: channelId } }));

  // Auto-mark notifications as read when viewing this channel
  useAutoMarkNotificationsRead({
    contextType: 'channel',
    contextId: channelId,
  });

  // Fetch community members and channels for mention resolution
  const { data: memberData = [] } = useQuery({
    ...membershipControllerFindAllForCommunityOptions({ path: { communityId: communityId || "" } }),
    enabled: !!communityId,
  });
  const { data: channelData = [] } = useQuery({
    ...channelsControllerGetMentionableChannelsOptions({ path: { communityId: communityId || "" } }),
    enabled: !!communityId,
  });

  // Convert to mention format
  const userMentions: UserMention[] = React.useMemo(() =>
    memberData.map((member) => ({
      id: member.user!.id,
      username: member.user!.username,
      displayName: member.user!.displayName || undefined,
    })), [memberData]);

  const channelMentions: ChannelMention[] = React.useMemo(() =>
    channelData.map((channel) => ({
      id: channel.id,
      name: channel.name,
    })), [channelData]);

  // Get messages using the hook directly (not in callback)
  const messagesHookResult = useChannelMessages(channelId);

  // Setup unified send message hook with callback
  const { sendMessage } = useSendMessage("channel", async (messageId: string) => {
    const files = pendingFilesRef.current;
    if (!files || files.length === 0) return;

    try {
      // Upload all files in parallel
      const uploadPromises = files.map(file =>
        uploadFile(file, {
          resourceType: "MESSAGE_ATTACHMENT",
          resourceId: messageId,
        })
      );

      const uploadedFiles = await Promise.all(uploadPromises);

      // Add each uploaded file to the message
      for (const uploadedFile of uploadedFiles) {
        await addAttachment({
          path: { id: messageId },
          body: { fileId: uploadedFile.id },
        });
      }
    } catch (error) {
      logger.error("Failed to upload files:", error);

      // Show error notification to user
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to upload file(s)";
      showNotification(errorMessage, "error");

      // Call addAttachment without fileId to decrement pendingAttachments
      for (let i = 0; i < files.length; i++) {
        await addAttachment({
          path: { id: messageId },
          body: {},
        });
      }
    } finally {
      // Clear pending files
      pendingFilesRef.current = null;
    }
  });

  const handleSendMessage = async (messageContent: string, spans: unknown[], files?: File[]) => {
    // Create message with pendingAttachments count
    const msg = {
      channelId,
      authorId,
      spans,
      attachments: [],
      pendingAttachments: files?.length || 0,
      reactions: [],
      sentAt: new Date().toISOString(),
    };

    // Store files in ref for callback
    pendingFilesRef.current = files || null;

    // Await the send so callers (MessageInput) can catch failures
    const result = await sendMessage(msg);
    if (!result.success) {
      const errorMessage = result.error instanceof Error ? result.error.message : "Failed to send message";
      showNotification(errorMessage, "error");
      return;
    }
  };

  // Create member list component for the channel
  const memberListComponent = (
    <MemberListContainer
      contextType="channel"
      contextId={channelId}
      communityId={communityId}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Channel Header - hidden on mobile which has its own app bar */}
      {!hideHeader && (
        <Paper
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            # {channel?.name || 'Channel'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={`Pinned messages (${pinnedMessages.length})`}>
              <IconButton size="small" onClick={() => setPinnedPanelOpen(true)}>
                <Badge badgeContent={pinnedMessages.length} color="primary" max={99}>
                  <PushPinIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Search messages">
              <IconButton size="small" onClick={handleSearchOpen}>
                <SearchIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <ChannelNotificationMenu
              channelId={channelId}
              channelName={channel?.name}
            />
          </Box>
        </Paper>
      )}

      {/* Message Search Popover */}
      <MessageSearch
        channelId={channelId}
        communityId={communityId || ""}
        anchorEl={searchAnchorEl}
        onClose={handleSearchClose}
      />

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <MessageContainerWrapper
          contextType="channel"
          contextId={channelId}
          communityId={communityId}
          useMessagesHook={() => messagesHookResult}
          userMentions={userMentions}
          channelMentions={channelMentions}
          onSendMessage={handleSendMessage}
          memberListComponent={memberListComponent}
          placeholder="Type a message... Use @ for members, @here, @channel"
          emptyStateMessage="No messages yet. Start the conversation!"
          highlightMessageId={highlightMessageId || undefined}
          onOpenThread={handleOpenThread}
        />
      </Box>

      {/* Pinned Messages Drawer */}
      <Drawer
        anchor="right"
        open={pinnedPanelOpen}
        onClose={() => setPinnedPanelOpen(false)}
        PaperProps={{
          sx: { width: 360 },
        }}
      >
        <PinnedMessagesPanel
          channelId={channelId}
          communityId={communityId || ""}
          onClose={() => setPinnedPanelOpen(false)}
        />
      </Drawer>

      {/* Thread Panel Drawer */}
      <Drawer
        anchor="right"
        open={!!openThreadId && !!threadParentMessage}
        onClose={handleCloseThread}
        PaperProps={{
          sx: {
            width: 400,
            height: '100dvh',
            overflow: 'hidden',
            paddingBottom: voiceConnected ? `${VOICE_BAR_HEIGHT}px` : 0,
          },
        }}
      >
        {threadParentMessage && (
          <ThreadPanel
            parentMessage={threadParentMessage}
            channelId={channelId}
            communityId={communityId}
          />
        )}
      </Drawer>
    </Box>
  );
};

export default ChannelMessageContainer;
