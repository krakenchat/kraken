import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { NotificationType } from '@prisma/client';
import { IsObjectId } from 'nestjs-object-id';

export class CreateNotificationDto {
  @IsObjectId()
  userId: string;

  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsObjectId()
  @IsOptional()
  messageId?: string;

  @IsObjectId()
  @IsOptional()
  channelId?: string;

  @IsObjectId()
  @IsOptional()
  directMessageGroupId?: string;

  @IsObjectId()
  authorId: string;

  @IsObjectId()
  @IsOptional()
  parentMessageId?: string;
}
