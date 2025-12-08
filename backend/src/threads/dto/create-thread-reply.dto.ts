import { IsString, IsOptional, IsArray, IsInt, Min } from 'class-validator';
import { $Enums } from '@prisma/client';

/**
 * DTO for creating a thread reply message.
 * Thread replies are stored as regular messages with a parentMessageId.
 */
export class CreateThreadReplyDto {
  @IsString()
  parentMessageId: string;

  @IsArray()
  spans: {
    type: $Enums.SpanType;
    text: string | null;
    userId: string | null;
    specialKind: string | null;
    channelId: string | null;
    communityId: string | null;
    aliasId: string | null;
  }[];

  @IsArray()
  @IsOptional()
  attachments?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  pendingAttachments?: number;
}
