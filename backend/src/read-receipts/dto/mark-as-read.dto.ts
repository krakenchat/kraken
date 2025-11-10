import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class MarkAsReadDto {
  @IsString()
  @IsNotEmpty()
  lastReadMessageId: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsString()
  @IsOptional()
  directMessageGroupId?: string;
}
