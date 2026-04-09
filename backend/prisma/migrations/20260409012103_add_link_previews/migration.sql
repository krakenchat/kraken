/*
  Warnings:

  - You are about to drop the column `searchVector` on the `Message` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Message_searchVector_idx";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "searchVector",
ADD COLUMN     "linkPreviews" JSONB;
