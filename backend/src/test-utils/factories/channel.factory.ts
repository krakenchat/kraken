import { Channel, ChannelType } from '@prisma/client';

export class ChannelFactory {
  private static counter = 0;

  static build(overrides: Partial<Channel> = {}): Channel {
    const id = overrides.id || this.generateId();
    const name = overrides.name || `channel-${this.counter++}`;

    return {
      id,
      name,
      communityId: overrides.communityId || this.generateId(),
      createdAt: overrides.createdAt || new Date(),
      type: overrides.type || ChannelType.TEXT,
      isPrivate: overrides.isPrivate ?? false,
      ...overrides,
    } as Channel;
  }

  static buildText(overrides: Partial<Channel> = {}): Channel {
    return this.build({
      type: ChannelType.TEXT,
      ...overrides,
    });
  }

  static buildVoice(overrides: Partial<Channel> = {}): Channel {
    return this.build({
      type: ChannelType.VOICE,
      ...overrides,
    });
  }

  static buildPrivate(overrides: Partial<Channel> = {}): Channel {
    return this.build({
      isPrivate: true,
      ...overrides,
    });
  }

  static buildMany(count: number, overrides: Partial<Channel> = {}): Channel[] {
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
