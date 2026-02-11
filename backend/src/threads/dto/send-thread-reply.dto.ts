import { IsString, IsOptional, IsArray, IsInt, Min } from 'class-validator';
import { $Enums } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { SpanTypeValues } from '@/common/enums/swagger-enums';

class SendThreadReplySpanDto {
  @ApiProperty({ enum: SpanTypeValues })
  type: $Enums.SpanType;
  text: string | null;
  userId: string | null;
  specialKind: string | null;
  communityId: string | null;
  aliasId: string | null;
}

/**
 * DTO for sending a thread reply via WebSocket.
 */
export class SendThreadReplyDto {
  @IsString()
  parentMessageId: string;

  @ApiProperty({ type: [SendThreadReplySpanDto] })
  @IsArray()
  spans: SendThreadReplySpanDto[];

  @IsArray()
  @IsOptional()
  attachments?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  pendingAttachments?: number;
}
