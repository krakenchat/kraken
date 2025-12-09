import { IsString, IsOptional, IsArray, IsInt, Min } from 'class-validator';
import { $Enums } from '@prisma/client';

/**
 * DTO for sending a thread reply via WebSocket.
 */
export class SendThreadReplyDto {
  @IsString()
  parentMessageId: string;

  @IsArray()
  spans: {
    type: $Enums.SpanType;
    text: string | null;
    userId: string | null;
    specialKind: string | null;
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
