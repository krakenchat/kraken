import { InstanceInvite } from '@prisma/client';

export class InstanceInviteFactory {
  private static counter = 0;

  static build(overrides: Partial<InstanceInvite> = {}): InstanceInvite {
    const id = overrides.id || this.generateId();
    const code = overrides.code || `INVITE${this.counter++}`;

    return {
      id,
      code,
      createdById: overrides.createdById || this.generateId(),
      defaultCommunityId: overrides.defaultCommunityId || [],
      maxUses: overrides.maxUses || null,
      uses: overrides.uses ?? 0,
      validUntil: overrides.validUntil || null,
      createdAt: overrides.createdAt || new Date(),
      usedByIds: overrides.usedByIds || [],
      disabled: overrides.disabled ?? false,
      ...overrides,
    } as InstanceInvite;
  }

  static buildUnlimited(
    overrides: Partial<InstanceInvite> = {},
  ): InstanceInvite {
    return this.build({
      maxUses: null,
      validUntil: null,
      ...overrides,
    });
  }

  static buildLimited(
    maxUses: number,
    overrides: Partial<InstanceInvite> = {},
  ): InstanceInvite {
    return this.build({
      maxUses,
      ...overrides,
    });
  }

  static buildExpired(overrides: Partial<InstanceInvite> = {}): InstanceInvite {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.build({
      validUntil: yesterday,
      ...overrides,
    });
  }

  static buildDisabled(
    overrides: Partial<InstanceInvite> = {},
  ): InstanceInvite {
    return this.build({
      disabled: true,
      ...overrides,
    });
  }

  static buildMany(
    count: number,
    overrides: Partial<InstanceInvite> = {},
  ): InstanceInvite[] {
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
