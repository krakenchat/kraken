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
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdateChannelOverrideDto } from './dto/update-channel-override.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@/types';
import { ParseObjectIdPipe } from 'nestjs-object-id';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get notifications for current user with pagination
   * GET /notifications?unreadOnly=true&limit=50&offset=0
   */
  @Get()
  async getNotifications(
    @Req() req: AuthenticatedRequest,
    @Query() query: NotificationQueryDto,
  ) {
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
  async getUnreadCount(@Req() req: AuthenticatedRequest) {
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
  ) {
    return this.notificationsService.markAsRead(notificationId, req.user.id);
  }

  /**
   * Mark all notifications as read
   * POST /notifications/read-all
   */
  @Post('read-all')
  @HttpCode(200)
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
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
  ) {
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
  ) {
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
  async getSettings(@Req() req: AuthenticatedRequest) {
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
  ) {
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
  ) {
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
  ) {
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
  ) {
    await this.notificationsService.deleteChannelOverride(
      req.user.id,
      channelId,
    );
  }
}
