import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { NotificationType } from '@prisma/client';
import { IsObjectId } from 'nestjs-object-id';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationTypeValues } from '@/common/enums/swagger-enums';

export class CreateNotificationDto {
  @IsObjectId()
  userId: string;

  @ApiProperty({ enum: NotificationTypeValues })
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
