import { Prisma } from '@prisma/client';

/**
 * Prisma select object containing only public user fields.
 * Use this instead of `include: { user: true }` to prevent
 * sensitive fields from being fetched at the query level.
 *
 * When adding new fields to the User model, update this constant
 * to include public fields or omit sensitive ones.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  role: true,
  avatarUrl: true,
  bannerUrl: true,
  lastSeen: true,
  displayName: true,
  bio: true,
  status: true,
} satisfies Prisma.UserSelect;
