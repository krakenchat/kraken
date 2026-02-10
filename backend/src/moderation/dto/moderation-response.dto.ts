import {
  FileType,
  ModerationLog,
  Message,
} from '@prisma/client';

export class PinnedMessageAuthorDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export class PinnedMessageAttachmentDto {
  id: string;
  filename: string;
  mimeType: string;
  fileType: FileType;
  size: number;
}

export type PinnedMessageDto = Omit<Message, 'attachments'> & {
  author: PinnedMessageAuthorDto | null;
  attachments: PinnedMessageAttachmentDto[];
};

export class TimeoutStatusResponseDto {
  isTimedOut: boolean;
  expiresAt?: Date;
}

export class ModerationLogsResponseDto {
  logs: ModerationLog[];
  total: number;
}

export class SuccessMessageDto {
  success: boolean;
  message: string;
}
