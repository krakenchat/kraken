import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsString()
  directMessageGroupId?: string;

  @IsNotEmpty()
  @IsString()
  authorId: string;
}
