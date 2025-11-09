import { User, InstanceRole } from '@prisma/client';

export class UserFactory {
  private static counter = 0;

  static build(overrides: Partial<User> = {}): User {
    const id = overrides.id || this.generateId();
    const username = overrides.username || `user${this.counter++}`;

    return {
      id,
      username,
      email: overrides.email || `${username}@example.com`,
      verified: overrides.verified ?? false,
      hashedPassword:
        overrides.hashedPassword || '$2b$10$dummyHashedPassword123',
      role: overrides.role || InstanceRole.USER,
      createdAt: overrides.createdAt || new Date(),
      avatarUrl: overrides.avatarUrl || null,
      lastSeen: overrides.lastSeen || null,
      displayName: overrides.displayName || null,
      ...overrides,
    } as User;
  }

  static buildOwner(overrides: Partial<User> = {}): User {
    return this.build({
      role: InstanceRole.OWNER,
      username: overrides.username || 'owner',
      ...overrides,
    });
  }

  static buildVerified(overrides: Partial<User> = {}): User {
    return this.build({
      verified: true,
      ...overrides,
    });
  }

  static buildMany(count: number, overrides: Partial<User> = {}): User[] {
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
