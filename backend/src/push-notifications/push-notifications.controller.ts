import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@/types';
import { PushNotificationsService } from './push-notifications.service';
import { SubscribePushDto, UnsubscribePushDto } from './dto/subscribe.dto';
import { InstanceRole } from '@prisma/client';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushNotificationsController {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  /**
   * Get the VAPID public key for client subscription
   * Returns null if push notifications are not configured
   */
  @Get('vapid-public-key')
  getVapidPublicKey(): { publicKey: string | null; enabled: boolean } {
    const publicKey = this.pushNotificationsService.getVapidPublicKey();
    return {
      publicKey,
      enabled: this.pushNotificationsService.isEnabled(),
    };
  }

  /**
   * Subscribe to push notifications
   */
  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubscribePushDto,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.pushNotificationsService.isEnabled()) {
      throw new NotFoundException(
        'Push notifications are not configured on this instance',
      );
    }

    await this.pushNotificationsService.subscribe(req.user.id, dto);
    return {
      success: true,
      message: 'Successfully subscribed to push notifications',
    };
  }

  /**
   * Unsubscribe from push notifications
   */
  @Delete('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UnsubscribePushDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.pushNotificationsService.unsubscribe(req.user.id, dto.endpoint);
    return {
      success: true,
      message: 'Successfully unsubscribed from push notifications',
    };
  }

  /**
   * Get current push subscription status
   */
  @Get('status')
  async getStatus(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ enabled: boolean; subscriptionCount: number }> {
    const subscriptions =
      await this.pushNotificationsService.getUserSubscriptions(req.user.id);
    return {
      enabled: this.pushNotificationsService.isEnabled(),
      subscriptionCount: subscriptions.length,
    };
  }

  // ============================================================================
  // DEBUG ENDPOINTS (Admin only)
  // ============================================================================

  /**
   * DEBUG: Send a test push notification to the current user
   * POST /push/debug/send-test
   * Only available to OWNER users
   */
  @Post('debug/send-test')
  @HttpCode(HttpStatus.OK)
  async sendTestPush(@Req() req: AuthenticatedRequest): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    message: string;
  }> {
    if (req.user.role !== InstanceRole.OWNER) {
      throw new ForbiddenException('Debug endpoints are admin-only');
    }

    if (!this.pushNotificationsService.isEnabled()) {
      throw new NotFoundException(
        'Push notifications are not configured on this instance. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env',
      );
    }

    const result = await this.pushNotificationsService.sendToUser(req.user.id, {
      title: 'Test Push Notification',
      body: 'This is a test push notification from the debug panel.',
      tag: `debug-test-${Date.now()}`,
      data: {
        type: 'DEBUG',
      },
    });

    return {
      success: result.sent > 0,
      sent: result.sent,
      failed: result.failed,
      message:
        result.sent > 0
          ? `Push notification sent to ${result.sent} device(s)`
          : 'No active push subscriptions found',
    };
  }
}
