-- AlterEnum
ALTER TYPE "SpanType" ADD VALUE 'CODE_BLOCK';

-- AlterTable
ALTER TABLE "MessageSpan" ADD COLUMN     "bold" BOOLEAN,
ADD COLUMN     "code" BOOLEAN,
ADD COLUMN     "italic" BOOLEAN,
ADD COLUMN     "strikethrough" BOOLEAN;
