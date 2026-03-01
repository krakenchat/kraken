import { Message } from '@prisma/client';

export class MessageFactory {
  private static counter = 0;

  static build(overrides: Partial<Message> = {}): Message {
    const id = overrides.id || this.generateId();

    return {
      id,
      channelId: overrides.channelId || this.generateId(),
      directMessageGroupId: overrides.directMessageGroupId || null,
      authorId: overrides.authorId || this.generateId(),
      sentAt: overrides.sentAt || new Date(),
      editedAt: overrides.editedAt || null,
      deletedAt: overrides.deletedAt || null,
      pendingAttachments: overrides.pendingAttachments ?? 0,
      searchText: overrides.searchText || `Test message ${this.counter++}`,
      pinned: overrides.pinned ?? false,
      pinnedAt: overrides.pinnedAt || null,
      pinnedBy: overrides.pinnedBy || null,
      deletedBy: overrides.deletedBy || null,
      deletedByReason: overrides.deletedByReason || null,
      parentMessageId: overrides.parentMessageId || null,
      replyCount: overrides.replyCount ?? 0,
      lastReplyAt: overrides.lastReplyAt || null,
      ...overrides,
    } as Message;
  }

  static buildDeleted(overrides: Partial<Message> = {}): Message {
    return this.build({
      deletedAt: new Date(),
      ...overrides,
    });
  }

  static buildEdited(overrides: Partial<Message> = {}): Message {
    return this.build({
      editedAt: new Date(),
      ...overrides,
    });
  }

  static buildDirectMessage(overrides: Partial<Message> = {}): Message {
    return this.build({
      channelId: null,
      directMessageGroupId: this.generateId(),
      ...overrides,
    });
  }

  static buildMany(count: number, overrides: Partial<Message> = {}): Message[] {
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
