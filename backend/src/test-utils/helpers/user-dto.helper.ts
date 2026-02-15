import { instanceToPlain } from 'class-transformer';

/**
 * Fields on the User model that must never be exposed to clients.
 * Used by test helpers to verify DTOs properly exclude sensitive data.
 *
 * When adding new sensitive fields to the User model, add them here.
 */
export const SENSITIVE_USER_FIELDS = [
  'hashedPassword',
  'email',
  'verified',
  'createdAt',
  'statusUpdatedAt',
  'banned',
  'bannedAt',
  'bannedById',
  'storageQuotaBytes',
  'storageUsedBytes',
] as const;

/**
 * Assert that a class-transformer DTO instance does not leak any sensitive
 * user fields when serialized via `instanceToPlain()`.
 */
export function expectNoSensitiveUserFields(dtoInstance: object): void {
  const plain = instanceToPlain(dtoInstance);
  for (const field of SENSITIVE_USER_FIELDS) {
    expect(plain).not.toHaveProperty(
      field,
      // Custom message for clear per-field failure output
    );
  }
}

/**
 * Assert that a plain object (e.g. a WebSocket payload) does not contain
 * any sensitive user fields.
 */
export function expectNoSensitiveFieldsInPlainObject(obj: object): void {
  for (const field of SENSITIVE_USER_FIELDS) {
    expect(obj).not.toHaveProperty(field);
  }
}
