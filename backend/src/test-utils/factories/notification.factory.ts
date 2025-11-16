import { Notification, NotificationType } from '@prisma/client';

export class NotificationFactory {
  private static counter = 0;

  static build(overrides: Partial<Notification> = {}): Notification {
    const id = overrides.id || this.generateId();

    return {
      id,
      userId: overrides.userId || this.generateId(),
      type: overrides.type || NotificationType.USER_MENTION,
      messageId: overrides.messageId || this.generateId(),
      channelId: overrides.channelId ?? null,
      directMessageGroupId: overrides.directMessageGroupId ?? null,
      authorId: overrides.authorId || this.generateId(),
      read: overrides.read ?? false,
      dismissed: overrides.dismissed ?? false,
      createdAt: overrides.createdAt || new Date(),
      ...overrides,
    } as Notification;
  }

  static buildForChannel(overrides: Partial<Notification> = {}): Notification {
    return this.build({
      channelId: overrides.channelId || this.generateId(),
      directMessageGroupId: null,
      type: NotificationType.USER_MENTION,
      ...overrides,
    });
  }

  static buildForDM(overrides: Partial<Notification> = {}): Notification {
    return this.build({
      channelId: null,
      directMessageGroupId: overrides.directMessageGroupId || this.generateId(),
      type: NotificationType.DIRECT_MESSAGE,
      ...overrides,
    });
  }

  static buildUserMention(overrides: Partial<Notification> = {}): Notification {
    return this.build({
      type: NotificationType.USER_MENTION,
      ...overrides,
    });
  }

  static buildSpecialMention(
    overrides: Partial<Notification> = {},
  ): Notification {
    return this.build({
      type: NotificationType.SPECIAL_MENTION,
      ...overrides,
    });
  }

  static buildRead(overrides: Partial<Notification> = {}): Notification {
    return this.build({
      read: true,
      ...overrides,
    });
  }

  static buildMany(
    count: number,
    overrides: Partial<Notification> = {},
  ): Notification[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }

  private static generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  static resetCounter(): void {
    this.counter = 0;
  }
}
