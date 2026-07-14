-- NOTE: Prisma's diff wants to DROP the Message."searchVector" generated
-- tsvector column + GIN index here because generated columns can't be
-- expressed in schema.prisma (see migration 20260307210420_restore_search_vector).
-- That DROP has been manually stripped from this migration; do not apply it.

-- CreateIndex
-- Supports Membership.findAllForCommunity's cursor-paginated page query
-- (where: communityId, orderBy: [joinedAt, id]).
CREATE INDEX "Membership_communityId_joinedAt_id_idx" ON "Membership"("communityId", "joinedAt", "id");
