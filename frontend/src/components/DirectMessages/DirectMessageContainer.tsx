import React from "react";
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
import { updateMessageInFlat } from "../../utils/messageCacheUpdaters";
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
          updateMessageInFlat(old as never, updatedMessage as import("../../types/message.type").Message)
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
      throw result.error || new Error("Failed to send message");
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
    />
  );
};

export default DirectMessageContainer;