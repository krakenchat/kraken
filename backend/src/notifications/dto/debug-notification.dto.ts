import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '@prisma/client';

/**
 * DTO for sending test notifications (debug only)
 * Used by admin users to test notification delivery
 */
export class SendTestNotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsString()
  customMessage?: string;
}
