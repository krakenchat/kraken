import { Role, RbacActions } from '@prisma/client';

export class RoleFactory {
  private static counter = 0;

  static build(overrides: Partial<Role> = {}): Role {
    const id = overrides.id || this.generateId();
    const name = overrides.name || `role-${this.counter++}`;

    return {
      id,
      name,
      actions: overrides.actions || [],
      communityId: overrides.communityId ?? null,
      isDefault: overrides.isDefault ?? false,
      createdAt: overrides.createdAt || new Date(),
      ...overrides,
    } as Role;
  }

  static buildAdmin(overrides: Partial<Role> = {}): Role {
    return this.build({
      name: 'Admin',
      actions: Object.values(RbacActions),
      isDefault: true,
      ...overrides,
    });
  }

  static buildModerator(overrides: Partial<Role> = {}): Role {
    return this.build({
      name: 'Moderator',
      actions: [
        RbacActions.DELETE_MESSAGE,
        RbacActions.READ_MESSAGE,
        RbacActions.READ_CHANNEL,
        RbacActions.CREATE_MESSAGE,
      ],
      isDefault: true,
      ...overrides,
    });
  }

  static buildMember(overrides: Partial<Role> = {}): Role {
    return this.build({
      name: 'Member',
      actions: [
        RbacActions.CREATE_MESSAGE,
        RbacActions.READ_MESSAGE,
        RbacActions.READ_CHANNEL,
        RbacActions.READ_COMMUNITY,
      ],
      isDefault: true,
      ...overrides,
    });
  }

  static buildMany(count: number, overrides: Partial<Role> = {}): Role[] {
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
