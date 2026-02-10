import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdateChannelOverrideDto } from './dto/update-channel-override.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { SendTestNotificationDto } from './dto/debug-notification.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@/types';
import { ParseObjectIdPipe } from 'nestjs-object-id';
import { InstanceRole, Notification, UserNotificationSettings, ChannelNotificationOverride } from '@prisma/client';
import { NotificationListResponseDto, UnreadCountResponseDto, DebugNotificationResponseDto, DebugSubscriptionsResponseDto, ClearNotificationDataResponseDto } from './dto/notification-response.dto';
import { PushNotificationsService } from '@/push-notifications/push-notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  /**
   * Get notifications for current user with pagination
   * GET /notifications?unreadOnly=true&limit=50&offset=0
   */
  @Get()
  async getNotifications(
    @Req() req: AuthenticatedRequest,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationListResponseDto> {
    const notifications = await this.notificationsService.getUserNotifications(
      req.user.id,
      query,
    );
    const unreadCount = await this.notificationsService.getUnreadCount(
      req.user.id,
    );

    // Return response matching frontend NotificationListResponse interface
    return {
      notifications,
      total: notifications.length,
      unreadCount,
    };
  }

  /**
   * Get unread notification count
   * GET /notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: AuthenticatedRequest): Promise<UnreadCountResponseDto> {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  /**
   * Mark a notification as read
   * POST /notifications/:id/read
   */
  @Post(':id/read')
  @HttpCode(200)
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseObjectIdPipe) notificationId: string,
  ): Promise<Notification> {
    return this.notificationsService.markAsRead(notificationId, req.user.id);
  }

  /**
   * Mark all notifications as read
   * POST /notifications/read-all
   */
  @Post('read-all')
  @HttpCode(200)
  async markAllAsRead(@Req() req: AuthenticatedRequest): Promise<{ count: number }> {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  /**
   * Dismiss a notification
   * POST /notifications/:id/dismiss
   */
  @Post(':id/dismiss')
  @HttpCode(200)
  async dismissNotification(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseObjectIdPipe) notificationId: string,
  ): Promise<Notification> {
    return this.notificationsService.dismissNotification(
      notificationId,
      req.user.id,
    );
  }

  /**
   * Delete a notification
   * DELETE /notifications/:id
   */
  @Delete(':id')
  @HttpCode(204)
  async deleteNotification(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseObjectIdPipe) notificationId: string,
  ): Promise<void> {
    await this.notificationsService.deleteNotification(
      notificationId,
      req.user.id,
    );
  }

  /**
   * Get user notification settings
   * GET /notifications/settings
   */
  @Get('settings')
  async getSettings(@Req() req: AuthenticatedRequest): Promise<UserNotificationSettings> {
    return this.notificationsService.getUserSettings(req.user.id);
  }

  /**
   * Update user notification settings
   * PUT /notifications/settings
   */
  @Put('settings')
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<UserNotificationSettings> {
    return this.notificationsService.updateUserSettings(req.user.id, dto);
  }

  /**
   * Get channel notification override
   * GET /notifications/channels/:channelId/override
   */
  @Get('channels/:channelId/override')
  async getChannelOverride(
    @Req() req: AuthenticatedRequest,
    @Param('channelId', ParseObjectIdPipe) channelId: string,
  ): Promise<ChannelNotificationOverride | null> {
    return this.notificationsService.getChannelOverride(req.user.id, channelId);
  }

  /**
   * Set channel notification override
   * PUT /notifications/channels/:channelId/override
   */
  @Put('channels/:channelId/override')
  async setChannelOverride(
    @Req() req: AuthenticatedRequest,
    @Param('channelId', ParseObjectIdPipe) channelId: string,
    @Body() dto: UpdateChannelOverrideDto,
  ): Promise<ChannelNotificationOverride> {
    return this.notificationsService.setChannelOverride(
      req.user.id,
      channelId,
      dto,
    );
  }

  /**
   * Delete channel notification override
   * DELETE /notifications/channels/:channelId/override
   */
  @Delete('channels/:channelId/override')
  @HttpCode(204)
  async deleteChannelOverride(
    @Req() req: AuthenticatedRequest,
    @Param('channelId', ParseObjectIdPipe) channelId: string,
  ): Promise<void> {
    await this.notificationsService.deleteChannelOverride(
      req.user.id,
      channelId,
    );
  }

  // ============================================================================
  // DEBUG ENDPOINTS (Admin only)
  // ============================================================================

  /**
   * Check if user is instance owner (used for debug endpoint access)
   */
  private assertOwner(req: AuthenticatedRequest): void {
    if (req.user.role !== InstanceRole.OWNER) {
      throw new ForbiddenException('Debug endpoints are admin-only');
    }
  }

  /**
   * DEBUG: Send a test notification to the current user
   * POST /notifications/debug/send-test
   * Only available to OWNER users
   */
  @Post('debug/send-test')
  @HttpCode(200)
  async sendTestNotification(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendTestNotificationDto,
  ): Promise<DebugNotificationResponseDto> {
    this.assertOwner(req);
    const notification = await this.notificationsService.createTestNotification(
      req.user.id,
      dto.type,
    );
    return {
      success: true,
      notification,
      message: `Test ${dto.type} notification created`,
    };
  }

  /**
   * DEBUG: Get all push subscriptions for current user
   * GET /notifications/debug/subscriptions
   * Only available to OWNER users
   */
  @Get('debug/subscriptions')
  async getDebugSubscriptions(@Req() req: AuthenticatedRequest): Promise<DebugSubscriptionsResponseDto> {
    this.assertOwner(req);
    const subscriptions =
      await this.pushNotificationsService.getUserSubscriptions(req.user.id);
    return {
      subscriptions,
      count: subscriptions.length,
      pushEnabled: this.pushNotificationsService.isEnabled(),
    };
  }

  /**
   * DEBUG: Clear all notification settings for current user
   * DELETE /notifications/debug/clear-all
   * Only available to OWNER users
   */
  @Delete('debug/clear-all')
  @HttpCode(200)
  async clearDebugSettings(@Req() req: AuthenticatedRequest): Promise<ClearNotificationDataResponseDto> {
    this.assertOwner(req);
    const result = await this.notificationsService.clearUserNotificationData(
      req.user.id,
    );
    return {
      success: true,
      ...result,
      message: 'All notification data cleared',
    };
  }
}
