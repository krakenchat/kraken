-- AlterEnum
ALTER TYPE "RbacActions" ADD VALUE 'MANAGE_EMOJIS';

-- AlterEnum
ALTER TYPE "SpanType" ADD VALUE 'EMOJI';

-- AlterTable
ALTER TABLE "MessageSpan" ADD COLUMN     "emojiId" TEXT;

-- CreateTable
CREATE TABLE "CustomEmoji" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomEmoji_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomEmoji_communityId_idx" ON "CustomEmoji"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomEmoji_communityId_name_key" ON "CustomEmoji"("communityId", "name");

-- AddForeignKey
ALTER TABLE "MessageSpan" ADD CONSTRAINT "MessageSpan_emojiId_fkey" FOREIGN KEY ("emojiId") REFERENCES "CustomEmoji"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomEmoji" ADD CONSTRAINT "CustomEmoji_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomEmoji" ADD CONSTRAINT "CustomEmoji_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
