import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { messagesControllerAddAttachmentMutation } from "../api-client/@tanstack/react-query.gen";
import { useFileUpload } from "./useFileUpload";
import { useSendMessage } from "./useSendMessage";
import { useNotification } from "../contexts/NotificationContext";
import { channelMessagesQueryKey, dmMessagesQueryKey } from "../utils/messageQueryKeys";
import { updateMessageInInfinite } from "../utils/messageCacheUpdaters";
import { logger } from "../utils/logger";
import type { Message } from "../types/message.type";

interface UseMessageFileUploadOptions {
  contextType: 'channel' | 'dm';
  contextId: string;
  authorId: string;
}

export const useMessageFileUpload = ({ contextType, contextId, authorId }: UseMessageFileUploadOptions) => {
  const queryClient = useQueryClient();
  const { uploadFile } = useFileUpload();
  const { showNotification } = useNotification();
  const pendingFilesRef = React.useRef<File[] | null>(null);

  const { mutateAsync: addAttachment } = useMutation({
    ...messagesControllerAddAttachmentMutation(),
    onSuccess: (updatedMessage) => {
      const id = contextType === 'channel'
        ? updatedMessage.channelId
        : updatedMessage.directMessageGroupId;
      if (id) {
        const queryKey = contextType === 'channel'
          ? channelMessagesQueryKey(id)
          : dmMessagesQueryKey(id);
        queryClient.setQueryData(queryKey, (old: unknown) =>
          updateMessageInInfinite(old as never, updatedMessage as Message)
        );
      }
    },
  });

  const { sendMessage } = useSendMessage(contextType, async (messageId: string) => {
    const files = pendingFilesRef.current;
    if (!files || files.length === 0) return;

    try {
      const uploadPromises = files.map(file =>
        uploadFile(file, {
          resourceType: "MESSAGE_ATTACHMENT",
          resourceId: messageId,
        })
      );

      const uploadedFiles = await Promise.all(uploadPromises);

      for (const uploadedFile of uploadedFiles) {
        await addAttachment({
          path: { id: messageId },
          body: { fileId: uploadedFile.id },
        });
      }
    } catch (error) {
      logger.error("Failed to upload files:", error);

      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to upload file(s)";
      showNotification(errorMessage, "error");

      for (let i = 0; i < files.length; i++) {
        await addAttachment({
          path: { id: messageId },
          body: {},
        });
      }
    } finally {
      pendingFilesRef.current = null;
    }
  });

  const handleSendMessage = async (messageContent: string, spans: unknown[], files?: File[]) => {
    const msg = {
      ...(contextType === 'channel'
        ? { channelId: contextId }
        : { directMessageGroupId: contextId }),
      authorId,
      spans,
      attachments: [],
      pendingAttachments: files?.length || 0,
      reactions: [],
      sentAt: new Date().toISOString(),
    };

    pendingFilesRef.current = files || null;

    const result = await sendMessage(msg);
    if (!result.success) {
      const errorMessage = result.error instanceof Error ? result.error.message : "Failed to send message";
      showNotification(errorMessage, "error");
      return;
    }
  };

  return { handleSendMessage };
};
