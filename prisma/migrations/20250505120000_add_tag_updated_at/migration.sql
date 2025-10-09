ALTER TABLE "Tag"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION set_tag_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tag_updated_at_trigger'
  ) THEN
    CREATE TRIGGER tag_updated_at_trigger
    BEFORE UPDATE ON "Tag"
    FOR EACH ROW
    EXECUTE FUNCTION set_tag_updated_at();
  END IF;
END $$;
