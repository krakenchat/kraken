-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RbacActions" ADD VALUE 'CREATE_SOUNDBOARD_SOUND';
ALTER TYPE "RbacActions" ADD VALUE 'DELETE_SOUNDBOARD_SOUND';
ALTER TYPE "RbacActions" ADD VALUE 'READ_SOUNDBOARD_SOUND';

-- AlterEnum
ALTER TYPE "ResourceType" ADD VALUE 'SOUNDBOARD_SOUND';

-- NOTE: Prisma's diff wants to DROP the Message."searchVector" generated
-- tsvector column + GIN index here because generated columns can't be
-- expressed in schema.prisma (see migration 20260307210420_restore_search_vector).
-- Those statements are intentionally omitted so full-text search keeps working.

-- CreateTable
CREATE TABLE "SoundboardSound" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "fileId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoundboardSound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoundboardSound_communityId_idx" ON "SoundboardSound"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "SoundboardSound_communityId_name_key" ON "SoundboardSound"("communityId", "name");

-- AddForeignKey
ALTER TABLE "SoundboardSound" ADD CONSTRAINT "SoundboardSound_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoundboardSound" ADD CONSTRAINT "SoundboardSound_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoundboardSound" ADD CONSTRAINT "SoundboardSound_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
