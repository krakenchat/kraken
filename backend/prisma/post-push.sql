-- Idempotent: add tsvector generated column + GIN index for full-text search

-- Step 1: Add generated column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Message' AND column_name = 'searchVector'
  ) THEN
    ALTER TABLE "Message" ADD COLUMN "searchVector" tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce("searchText", ''))) STORED;
  END IF;
END $$;

-- Step 2: Add GIN index if it doesn't exist
CREATE INDEX IF NOT EXISTS "Message_searchVector_idx" ON "Message" USING GIN ("searchVector");
