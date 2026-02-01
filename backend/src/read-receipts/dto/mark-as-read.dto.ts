import { IsOptional } from 'class-validator';
import { IsObjectId } from 'nestjs-object-id';

export class MarkAsReadDto {
  @IsObjectId()
  lastReadMessageId: string;

  @IsObjectId()
  @IsOptional()
  channelId?: string;

  @IsObjectId()
  @IsOptional()
  directMessageGroupId?: string;
}
