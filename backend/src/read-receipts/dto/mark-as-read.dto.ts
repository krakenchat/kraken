import { IsOptional, IsUUID } from 'class-validator';

export class MarkAsReadDto {
  @IsUUID()
  lastReadMessageId: string;

  @IsUUID()
  @IsOptional()
  channelId?: string;

  @IsUUID()
  @IsOptional()
  directMessageGroupId?: string;
}
