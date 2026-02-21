import { IsString, IsOptional } from 'class-validator';

export class TypingEventDto {
  @IsString()
  @IsOptional()
  channelId?: string;

  @IsString()
  @IsOptional()
  directMessageGroupId?: string;
}
