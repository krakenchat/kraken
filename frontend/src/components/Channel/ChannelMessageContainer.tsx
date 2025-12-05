import React, { useState } from "react";
import { Box, Typography, Paper, IconButton, Tooltip, Badge, Drawer } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PushPinIcon from "@mui/icons-material/PushPin";
import MessageContainerWrapper from "../Message/MessageContainerWrapper";
import MemberListContainer from "../Message/MemberListContainer";
import MessageSearch from "../Message/MessageSearch";
import { PinnedMessagesPanel } from "../Moderation";
import { useParams } from "react-router-dom";
import { useChannelMessages } from "../../hooks/useChannelMessages";
import { useSendMessage } from "../../hooks/useSendMessage";
import { useGetMembersForCommunityQuery } from "../../features/membership/membershipApiSlice";
import { useGetMentionableChannelsQuery, useGetChannelByIdQuery } from "../../features/channel/channelApiSlice";
import { useProfileQuery } from "../../features/users/usersSlice";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useAddAttachmentMutation } from "../../features/messages/messagesApiSlice";
import { useGetPinnedMessagesQuery } from "../../features/moderation/moderationApiSlice";
import { useNotification } from "../../contexts/NotificationContext";
import ChannelNotificationMenu from "./ChannelNotificationMenu";
import { useAutoMarkNotificationsRead } from "../../hooks/useAutoMarkNotificationsRead";
import type { UserMention, ChannelMention } from "../../utils/mentionParser";

interface ChannelMessageContainerProps {
  channelId: string;
}

const ChannelMessageContainer: React.FC<ChannelMessageContainerProps> = ({
  channelId,
}) => {
  const { data: user } = useProfileQuery();
  const authorId = user?.id || "";

  // Get communityId from context
  const { communityId } = useParams<{
    communityId: string;
  }>();

  const { uploadFile } = useFileUpload();
  const [addAttachment] = useAddAttachmentMutation();
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
  const { data: pinnedMessages = [] } = useGetPinnedMessagesQuery(channelId);

  // Fetch channel data for header
  const { data: channel } = useGetChannelByIdQuery(channelId);

  // Auto-mark notifications as read when viewing this channel
  useAutoMarkNotificationsRead({
    contextType: 'channel',
    contextId: channelId,
  });

  // Fetch community members and channels for mention resolution
  const { data: memberData = [] } = useGetMembersForCommunityQuery(communityId || "");
  const { data: channelData = [] } = useGetMentionableChannelsQuery(communityId || "");

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
          messageId,
          fileId: uploadedFile.id,
        });
      }
    } catch (error) {
      console.error("Failed to upload files:", error);

      // Show error notification to user
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to upload file(s)";
      showNotification(errorMessage, "error");

      // Call addAttachment without fileId to decrement pendingAttachments
      for (let i = 0; i < files.length; i++) {
        await addAttachment({
          messageId,
          // No fileId means upload failed, just decrement counter
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

    // Send message immediately (optimistic)
    sendMessage(msg);
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
      {/* Channel Header */}
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
    </Box>
  );
};

export default ChannelMessageContainer;
