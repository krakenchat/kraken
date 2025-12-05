import { $Enums, Message } from '@prisma/client';
import { Exclude } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsDate,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ArrayMinLength } from '../../decorators/array-min-length.decorator';

export class CreateMessageDto implements Message {
  @Exclude()
  id: string;

  @IsOptional()
  @IsString()
  channelId: string | null;

  @IsOptional()
  @IsString()
  directMessageGroupId: string | null;

  authorId: string;
  sentAt: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  editedAt: Date | null;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  deletedAt: Date | null;

  @IsArray()
  @ArrayMinLength(1, { message: 'At least one span is required' })
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
  attachments: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  pendingAttachments: number | null;

  @Exclude()
  searchText: string | null;

  @Exclude()
  reactions: { emoji: string; userIds: string[] }[];
}
