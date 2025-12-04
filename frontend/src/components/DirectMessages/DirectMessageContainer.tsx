import React from "react";
import MessageContainerWrapper from "../Message/MessageContainerWrapper";
import MemberListContainer from "../Message/MemberListContainer";
import { useDirectMessages } from "../../hooks/useDirectMessages";
import { useGetDmGroupQuery } from "../../features/directMessages/directMessagesApiSlice";
import { useProfileQuery } from "../../features/users/usersSlice";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useAddAttachmentMutation } from "../../features/messages/messagesApiSlice";
import { useNotification } from "../../contexts/NotificationContext";
import { useSendMessage } from "../../hooks/useSendMessage";
import { useAutoMarkNotificationsRead } from "../../hooks/useAutoMarkNotificationsRead";
import type { UserMention } from "../../utils/mentionParser";

interface DirectMessageContainerProps {
  dmGroupId: string;
}

const DirectMessageContainer: React.FC<DirectMessageContainerProps> = ({
  dmGroupId,
}) => {
  const { data: user } = useProfileQuery();
  const authorId = user?.id || "";

  const { uploadFile } = useFileUpload();
  const [addAttachment] = useAddAttachmentMutation();
  const { showNotification } = useNotification();
  const pendingFilesRef = React.useRef<File[] | null>(null);

  // Get DM group info to get members for mentions
  const { data: dmGroup } = useGetDmGroupQuery(dmGroupId);

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

    // Send message immediately (optimistic)
    sendMessage(msg);
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