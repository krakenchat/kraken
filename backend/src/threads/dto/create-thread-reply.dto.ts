import { IsString, IsOptional, IsArray, IsInt, Min } from 'class-validator';
import { $Enums } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { SpanTypeValues } from '@/common/enums/swagger-enums';

class ThreadReplySpanDto {
  @ApiProperty({ enum: SpanTypeValues })
  type: $Enums.SpanType;
  text: string | null;
  userId: string | null;
  specialKind: string | null;
  communityId: string | null;
  aliasId: string | null;
}

/**
 * DTO for creating a thread reply message.
 * Thread replies are stored as regular messages with a parentMessageId.
 */
export class CreateThreadReplyDto {
  @IsString()
  parentMessageId: string;

  @ApiProperty({ type: [ThreadReplySpanDto] })
  @IsArray()
  spans: ThreadReplySpanDto[];

  @IsArray()
  @IsOptional()
  attachments?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  pendingAttachments?: number;
}
