import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PushNotificationsService } from '@/push-notifications/push-notifications.service';
import { PushMarkReadDto } from './dto/push-mark-read.dto';
import { SuccessMessageDto } from '@/common/dto/common-response.dto';

/**
 * Endpoints hit by the service worker's push-notification action buttons.
 *
 * These are intentionally UNAUTHENTICATED (no JwtAuthGuard) — the service
 * worker deliberately stores no JWT, so the signed, scoped `token` in the
 * request body IS the auth. Each token is single-purpose: it authorizes
 * marking exactly one notification as read for the user it was issued to,
 * and expires after 7 days. See
 * docs/superpowers/specs/2026-08-09-push-notification-actions-design.md
 * for the full design rationale.
 */
@Controller('notifications/push')
export class PushActionsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  /**
   * Mark a notification as read from a push notification action button.
   * POST /notifications/push/mark-read
   */
  @Post('mark-read')
  @HttpCode(200)
  @ApiOkResponse({ type: SuccessMessageDto })
  async markRead(@Body() dto: PushMarkReadDto): Promise<SuccessMessageDto> {
    const claims = this.pushNotificationsService.verifyActionToken(dto.token);
    if (!claims) {
      throw new UnauthorizedException('Invalid or expired action token');
    }

    await this.notificationsService.markAsRead(
      claims.notificationId,
      claims.userId,
    );

    return { success: true, message: 'Notification marked as read' };
  }
}
