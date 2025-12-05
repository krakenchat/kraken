import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { DatabaseService } from '@/database/database.service';
import { SubscribePushDto } from './dto/subscribe.dto';
import { PushSubscription } from '@prisma/client';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private isConfigured = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  onModuleInit() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      this.configService.get<string>('VAPID_SUBJECT') ||
      'mailto:admin@localhost';

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not configured. Push notifications are disabled. ' +
          'Generate keys with: npx web-push generate-vapid-keys',
      );
      return;
    }

    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.isConfigured = true;
      this.logger.log('Push notifications configured successfully');
    } catch (error) {
      this.logger.error('Failed to configure VAPID details:', error);
    }
  }

  /**
   * Check if push notifications are enabled
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Get the VAPID public key for client subscription
   */
  getVapidPublicKey(): string | null {
    if (!this.isConfigured) return null;
    return this.configService.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userId: string,
    dto: SubscribePushDto,
  ): Promise<PushSubscription> {
    // Cast keys to JSON-compatible format for Prisma
    const keysJson = {
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    };

    // Upsert - update if endpoint exists, create if not
    return this.databaseService.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: {
        userId,
        keys: keysJson,
        userAgent: dto.userAgent,
        updatedAt: new Date(),
      },
      create: {
        userId,
        endpoint: dto.endpoint,
        keys: keysJson,
        userAgent: dto.userAgent,
      },
    });
  }

  /**
   * Unsubscribe a user from push notifications
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.databaseService.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  /**
   * Get all push subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    return this.databaseService.pushSubscription.findMany({
      where: { userId },
    });
  }

  /**
   * Send a push notification to all of a user's subscriptions
   */
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<{ sent: number; failed: number }> {
    if (!this.isConfigured) {
      this.logger.debug('Push notifications not configured, skipping');
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await this.getUserSubscriptions(userId);
    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      subscriptions.map((sub) => this.sendToSubscription(sub, payload)),
    );

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        // Handle expired/invalid subscriptions
        const error = result.reason as { statusCode?: number };
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription expired or not found - remove it
          await this.removeInvalidSubscription(subscriptions[i].id);
        } else {
          this.logger.error(
            `Failed to send push to subscription ${subscriptions[i].id}:`,
            result.reason,
          );
        }
      }
    }

    return { sent, failed };
  }

  /**
   * Send to a specific subscription
   */
  private async sendToSubscription(
    subscription: PushSubscription,
    payload: PushNotificationPayload,
  ): Promise<void> {
    const keys = subscription.keys as { p256dh: string; auth: string };

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: 'normal',
      },
    );
  }

  /**
   * Remove an invalid/expired subscription
   */
  private async removeInvalidSubscription(
    subscriptionId: string,
  ): Promise<void> {
    try {
      await this.databaseService.pushSubscription.delete({
        where: { id: subscriptionId },
      });
      this.logger.debug(`Removed invalid subscription: ${subscriptionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove invalid subscription ${subscriptionId}:`,
        error,
      );
    }
  }

  /**
   * Clean up expired subscriptions (can be called by a cron job)
   */
  async cleanupExpiredSubscriptions(): Promise<number> {
    // Remove subscriptions older than 30 days that haven't been updated
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.databaseService.pushSubscription.deleteMany({
      where: {
        updatedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired push subscriptions`);
    }

    return result.count;
  }
}
