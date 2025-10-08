-- Ensure tags can store progression metadata
ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "statKey" TEXT;

-- Capture productivity samples for model training
CREATE TABLE IF NOT EXISTS "ProductivitySample" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayOfWeek" INTEGER NOT NULL,
    "hourOfDay" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "taskType" TEXT NOT NULL,
    "energyLevel" INTEGER,
    "overlapWithUni" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN NOT NULL,
    "mood" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductivitySample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductivitySample_userId_recordedAt_idx"
    ON "ProductivitySample" ("userId", "recordedAt");

CREATE INDEX IF NOT EXISTS "ProductivitySample_userId_sourceType_sourceId_idx"
    ON "ProductivitySample" ("userId", "sourceType", "sourceId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ProductivitySample_userId_fkey'
    ) THEN
        ALTER TABLE "ProductivitySample"
            ADD CONSTRAINT "ProductivitySample_userId_fkey"
            FOREIGN KEY ("userId")
            REFERENCES "User"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;
END $$;
