import { Message, SpanType } from '@prisma/client';

export class MessageFactory {
  private static counter = 0;

  static build(overrides: Partial<Message> = {}): Message {
    const id = overrides.id || this.generateId();

    return {
      id,
      channelId: overrides.channelId || this.generateId(),
      directMessageGroupId: overrides.directMessageGroupId || null,
      authorId: overrides.authorId || this.generateId(),
      spans: overrides.spans || [
        {
          type: SpanType.PLAINTEXT,
          text: `Test message ${this.counter++}`,
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
      ],
      reactions: overrides.reactions || [],
      sentAt: overrides.sentAt || new Date(),
      editedAt: overrides.editedAt || null,
      deletedAt: overrides.deletedAt || null,
      attachments: overrides.attachments || [],
      pendingAttachments: overrides.pendingAttachments ?? 0,
      ...overrides,
    } as Message;
  }

  static buildWithAttachments(
    fileIds: string[],
    overrides: Partial<Message> = {},
  ): Message {
    return this.build({
      attachments: fileIds,
      ...overrides,
    });
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

  static buildWithReactions(overrides: Partial<Message> = {}): Message {
    return this.build({
      reactions: [
        { emoji: '👍', userIds: [this.generateId()] },
        { emoji: '❤️', userIds: [this.generateId(), this.generateId()] },
      ],
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
