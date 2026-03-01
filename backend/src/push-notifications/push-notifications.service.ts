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
  private vapidPublicKey: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit() {
    const envPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const envPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const envSubject = this.configService.get<string>('VAPID_SUBJECT');

    // Tier 1: Use env vars if both keys are present
    if (envPublicKey && envPrivateKey) {
      const subject = envSubject || 'mailto:admin@localhost';
      this.applyVapidDetails(subject, envPublicKey, envPrivateKey, 'env vars');
      return;
    }

    // Tier 2: Check database for stored keys
    try {
      const settings = await this.databaseService.instanceSettings.findFirst();
      if (settings?.vapidPublicKey && settings?.vapidPrivateKey) {
        const subject =
          envSubject || settings.vapidSubject || 'mailto:admin@localhost';
        this.applyVapidDetails(
          subject,
          settings.vapidPublicKey,
          settings.vapidPrivateKey,
          'database',
        );
        return;
      }

      // Tier 3: Auto-generate and persist (multi-instance safe)
      const generated = webpush.generateVAPIDKeys();
      const subject = envSubject || 'mailto:admin@localhost';

      // Persist using conditional write to handle concurrent pod startup.
      // If another instance already wrote keys, updateMany matches 0 rows.
      if (settings) {
        const result = await this.databaseService.instanceSettings.updateMany({
          where: {
            id: settings.id,
            vapidPublicKey: null,
          },
          data: {
            vapidPublicKey: generated.publicKey,
            vapidPrivateKey: generated.privateKey,
            vapidSubject: subject,
          },
        });

        if (result.count === 0) {
          // Another instance won the race — reload and use its keys
          const reloaded =
            await this.databaseService.instanceSettings.findFirst();
          if (reloaded?.vapidPublicKey && reloaded?.vapidPrivateKey) {
            const effectiveSubject =
              envSubject || reloaded.vapidSubject || 'mailto:admin@localhost';
            this.applyVapidDetails(
              effectiveSubject,
              reloaded.vapidPublicKey,
              reloaded.vapidPrivateKey,
              'database (concurrent)',
            );
            return;
          }
        }
      } else {
        await this.databaseService.instanceSettings.create({
          data: {
            vapidPublicKey: generated.publicKey,
            vapidPrivateKey: generated.privateKey,
            vapidSubject: subject,
          },
        });
      }

      this.applyVapidDetails(
        subject,
        generated.publicKey,
        generated.privateKey,
        'auto-generated',
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialize VAPID keys from database:',
        error,
      );
    }
  }

  private applyVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
    source: string,
  ) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidPublicKey = publicKey;
      this.isConfigured = true;
      this.logger.log(
        `Push notifications configured successfully (source: ${source})`,
      );
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
    return this.vapidPublicKey;
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
