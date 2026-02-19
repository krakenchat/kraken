import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import MessageContainerWrapper from "../Message/MessageContainerWrapper";
import MemberListContainer from "../Message/MemberListContainer";
import { useDirectMessages } from "../../hooks/useDirectMessages";
import { useQuery } from "@tanstack/react-query";
import { directMessagesControllerFindDmGroupOptions, userControllerGetProfileOptions } from "../../api-client/@tanstack/react-query.gen";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { messagesControllerAddAttachmentMutation } from "../../api-client/@tanstack/react-query.gen";
import { useNotification } from "../../contexts/NotificationContext";
import { dmMessagesQueryKey } from "../../utils/messageQueryKeys";
import { updateMessageInInfinite } from "../../utils/messageCacheUpdaters";
import { useSendMessage } from "../../hooks/useSendMessage";
import { useAutoMarkNotificationsRead } from "../../hooks/useAutoMarkNotificationsRead";
import type { UserMention } from "../../utils/mentionParser";
import { logger } from "../../utils/logger";

interface DirectMessageContainerProps {
  dmGroupId: string;
}

const DirectMessageContainer: React.FC<DirectMessageContainerProps> = ({
  dmGroupId,
}) => {
  const { data: user } = useQuery(userControllerGetProfileOptions());
  const authorId = user?.id || "";

  const queryClient = useQueryClient();
  const { uploadFile } = useFileUpload();
  const { mutateAsync: addAttachment } = useMutation({
    ...messagesControllerAddAttachmentMutation(),
    onSuccess: (updatedMessage) => {
      if (updatedMessage.directMessageGroupId) {
        const queryKey = dmMessagesQueryKey(updatedMessage.directMessageGroupId);
        queryClient.setQueryData(queryKey, (old: unknown) =>
          updateMessageInInfinite(old as never, updatedMessage as import("../../types/message.type").Message)
        );
      }
    },
  });
  const { showNotification } = useNotification();
  const pendingFilesRef = React.useRef<File[] | null>(null);

  // Get DM group info to get members for mentions
  const { data: dmGroup } = useQuery(directMessagesControllerFindDmGroupOptions({ path: { id: dmGroupId } }));

  // Auto-mark notifications as read when viewing this DM
  useAutoMarkNotificationsRead({
    contextType: 'dm',
    contextId: dmGroupId,
  });

  // Get highlight message ID from URL params (for notification deep linking)
  const [searchParams] = useSearchParams();
  const dmNavigate = useNavigate();
  const highlightMessageId = searchParams.get("highlight");

  // Clear highlight param from URL after a delay (so the flash animation can play)
  React.useEffect(() => {
    if (highlightMessageId) {
      const timer = setTimeout(() => {
        dmNavigate(`/direct-messages?group=${dmGroupId}`, { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightMessageId, dmGroupId, dmNavigate]);

  // Convert DM group members to mention format
  const userMentions: UserMention[] = React.useMemo(() => {
    return dmGroup?.members?.map((member) => ({
      id: member.user.id,
      username: member.user.username,
      displayName: member.user.displayName || undefined,
    })) || [];
  }, [dmGroup?.members]);

  // Get messages using the hook directly (not in callback)
  const messagesHookResult = useDirectMessages(dmGroupId);

  // Setup unified send message hook with callback
  const { sendMessage } = useSendMessage("dm", async (messageId: string) => {
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
      directMessageGroupId: dmGroupId,
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

  // Create member list component for the DM group
  const memberListComponent = (
    <MemberListContainer
      contextType="dm"
      contextId={dmGroupId}
    />
  );

  return (
    <MessageContainerWrapper
      contextType="dm"
      contextId={dmGroupId}
      useMessagesHook={() => messagesHookResult}
      userMentions={userMentions}
      onSendMessage={handleSendMessage}
      memberListComponent={memberListComponent}
      placeholder="Type a direct message..."
      emptyStateMessage="No messages yet. Start the conversation!"
      highlightMessageId={highlightMessageId || undefined}
    />
  );
};

export default DirectMessageContainer;