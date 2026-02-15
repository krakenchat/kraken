import { instanceToPlain } from 'class-transformer';
import { UserEntity } from './user-response.dto';
import {
  UserFactory,
  SENSITIVE_USER_FIELDS,
  expectNoSensitiveUserFields,
} from '@/test-utils';

describe('UserEntity', () => {
  describe('Sensitive field exclusion', () => {
    it('should exclude all sensitive fields from serialized output', () => {
      const user = UserFactory.buildComplete();
      const entity = new UserEntity(user);

      expectNoSensitiveUserFields(entity);
    });

    it.each(SENSITIVE_USER_FIELDS)(
      'should exclude %s from serialized output',
      (field) => {
        const user = UserFactory.buildComplete();
        const entity = new UserEntity(user);
        const plain = instanceToPlain(entity);

        expect(plain).not.toHaveProperty(field);
      },
    );
  });

  describe('Public fields', () => {
    it('should preserve public fields in serialized output', () => {
      const user = UserFactory.buildComplete();
      const entity = new UserEntity(user);
      const plain = instanceToPlain(entity);

      expect(plain.id).toBe(user.id);
      expect(plain.username).toBe(user.username);
      expect(plain.role).toBe(user.role);
      expect(plain.avatarUrl).toBe(user.avatarUrl);
      expect(plain.bannerUrl).toBe(user.bannerUrl);
      expect(plain.displayName).toBe(user.displayName);
      expect(plain.bio).toBe(user.bio);
      expect(plain.status).toBe(user.status);
      expect(plain.lastSeen).toEqual(user.lastSeen);
    });
  });

  describe('JSON serialization', () => {
    it('should serialize to valid JSON without BigInt errors', () => {
      const user = UserFactory.buildComplete();
      const entity = new UserEntity(user);
      const plain = instanceToPlain(entity);

      expect(() => JSON.stringify(plain)).not.toThrow();

      const json = JSON.stringify(plain);
      const parsed = JSON.parse(json);

      expect(parsed.username).toBe(user.username);
      expect(parsed.hashedPassword).toBeUndefined();
      expect(parsed.storageQuotaBytes).toBeUndefined();
      expect(parsed.storageUsedBytes).toBeUndefined();
    });
  });
});
