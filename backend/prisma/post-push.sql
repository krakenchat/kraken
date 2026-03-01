-- Idempotent: add tsvector generated column + GIN index for full-text search
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Message' AND column_name = 'searchVector'
  ) THEN
    ALTER TABLE "Message" ADD COLUMN "searchVector" tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce("searchText", ''))) STORED;
    CREATE INDEX "Message_searchVector_idx" ON "Message" USING GIN ("searchVector");
  END IF;
END $$;
