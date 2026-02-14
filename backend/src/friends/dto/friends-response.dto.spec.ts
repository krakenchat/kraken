import { instanceToPlain } from 'class-transformer';
import { FriendUserDto } from './friends-response.dto';
import { InstanceRole } from '@prisma/client';

describe('FriendUserDto', () => {
  describe('Excluded fields', () => {
    it('should exclude storageQuotaBytes and storageUsedBytes from serialized output', () => {
      const user = new FriendUserDto({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        verified: true,
        role: InstanceRole.USER,
        createdAt: new Date(),
        avatarUrl: null,
        bannerUrl: null,
        lastSeen: null,
        displayName: 'Test User',
        bio: null,
        status: null,
        statusUpdatedAt: null,
        banned: false,
        bannedAt: null,
        bannedById: null,
        storageQuotaBytes: BigInt(53687091200), // 50GB
        storageUsedBytes: BigInt(1073741824), // 1GB
        hashedPassword: 'hashed',
      });

      const plain = instanceToPlain(user);

      expect(plain.storageQuotaBytes).toBeUndefined();
      expect(plain.storageUsedBytes).toBeUndefined();
    });

    it('should exclude hashedPassword from serialized output', () => {
      const user = new FriendUserDto({
        id: 'user-123',
        username: 'testuser',
        hashedPassword: 'secret-hash',
        storageQuotaBytes: BigInt(0),
        storageUsedBytes: BigInt(0),
      } as any);

      const plain = instanceToPlain(user);

      expect(plain.hashedPassword).toBeUndefined();
    });

    it('should exclude email from serialized output', () => {
      const user = new FriendUserDto({
        id: 'user-123',
        username: 'testuser',
        email: 'secret@example.com',
        storageQuotaBytes: BigInt(0),
        storageUsedBytes: BigInt(0),
      } as any);

      const plain = instanceToPlain(user);

      expect(plain.email).toBeUndefined();
    });

    it('should exclude banned from serialized output', () => {
      const user = new FriendUserDto({
        id: 'user-123',
        username: 'testuser',
        banned: true,
        storageQuotaBytes: BigInt(0),
        storageUsedBytes: BigInt(0),
      } as any);

      const plain = instanceToPlain(user);

      expect(plain.banned).toBeUndefined();
    });

    it('should exclude verified from serialized output', () => {
      const user = new FriendUserDto({
        id: 'user-123',
        username: 'testuser',
        verified: true,
        storageQuotaBytes: BigInt(0),
        storageUsedBytes: BigInt(0),
      } as any);

      const plain = instanceToPlain(user);

      expect(plain.verified).toBeUndefined();
    });
  });

  describe('Public fields', () => {
    it('should preserve public fields in serialized output', () => {
      const now = new Date('2024-01-02');
      const user = new FriendUserDto({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        verified: true,
        role: InstanceRole.USER,
        createdAt: new Date('2024-01-01'),
        avatarUrl: 'https://example.com/avatar.png',
        bannerUrl: 'https://example.com/banner.png',
        lastSeen: now,
        displayName: 'Test User',
        bio: 'Hello world',
        status: 'online',
        statusUpdatedAt: now,
        banned: false,
        bannedAt: null,
        bannedById: null,
        storageQuotaBytes: BigInt(53687091200),
        storageUsedBytes: BigInt(1073741824),
        hashedPassword: 'hashed',
      });

      const plain = instanceToPlain(user);

      expect(plain.id).toBe('user-123');
      expect(plain.username).toBe('testuser');
      expect(plain.displayName).toBe('Test User');
      expect(plain.avatarUrl).toBe('https://example.com/avatar.png');
      expect(plain.bio).toBe('Hello world');
      expect(plain.status).toBe('online');
      expect(plain.lastSeen).toEqual(now);
    });
  });

  describe('JSON serialization', () => {
    it('should serialize to valid JSON without BigInt errors', () => {
      const user = new FriendUserDto({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        verified: true,
        role: InstanceRole.OWNER,
        createdAt: new Date('2024-01-01'),
        avatarUrl: null,
        bannerUrl: null,
        lastSeen: new Date('2024-01-02'),
        displayName: 'Test User',
        bio: 'Bio text',
        status: 'online',
        statusUpdatedAt: new Date('2024-01-02'),
        banned: false,
        bannedAt: null,
        bannedById: null,
        storageQuotaBytes: BigInt(107374182400), // 100GB
        storageUsedBytes: BigInt(5368709120), // 5GB
        hashedPassword: 'hashed',
      });

      const plain = instanceToPlain(user);

      // This should not throw "Do not know how to serialize a BigInt"
      expect(() => JSON.stringify(plain)).not.toThrow();

      const json = JSON.stringify(plain);
      const parsed = JSON.parse(json);

      expect(parsed.username).toBe('testuser');
      expect(parsed.displayName).toBe('Test User');
      expect(parsed.hashedPassword).toBeUndefined();
      expect(parsed.storageQuotaBytes).toBeUndefined();
      expect(parsed.storageUsedBytes).toBeUndefined();
    });
  });
});
