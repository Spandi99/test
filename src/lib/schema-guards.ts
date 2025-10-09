import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

let tagSchemaEnsured = false;
let productivitySchemaEnsured = false;

async function executeGuard(statement: string) {
  try {
    await prisma.$executeRawUnsafe(statement);
  } catch (error) {
    logger.warn(
      "Schema guard statement failed",
      {
        statement,
        error: error instanceof Error ? error.message : String(error),
      },
      "schema-guard"
    );
    throw error;
  }
}

export async function ensureTagProgressionSchema() {
  if (tagSchemaEnsured) {
    return;
  }

  try {
    await executeGuard(
      'ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "category" TEXT'
    );
    await executeGuard(
      'ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "statKey" TEXT'
    );
    await executeGuard(
      'ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'
    );
    await executeGuard(
      'ALTER TABLE "Tag" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP'
    );
    tagSchemaEnsured = true;
  } catch (error) {
    logger.warn(
      "Failed to ensure tag progression schema",
      { error: error instanceof Error ? error.message : String(error) },
      "schema-guard"
    );
  }
}

export async function ensureProductivitySampleSchema() {
  if (productivitySchemaEnsured) {
    return;
  }

  try {
    await executeGuard(`
      CREATE TABLE IF NOT EXISTS "ProductivitySample" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "sourceType" TEXT NOT NULL,
        "sourceId" TEXT NOT NULL,
        "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dayOfWeek" INTEGER NOT NULL,
        "hourOfDay" INTEGER NOT NULL,
        "duration" INTEGER NOT NULL,
        "taskType" TEXT NOT NULL,
        "energyLevel" INTEGER,
        "overlapWithUni" BOOLEAN NOT NULL DEFAULT FALSE,
        "success" BOOLEAN NOT NULL DEFAULT FALSE,
        "mood" INTEGER,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await executeGuard(
      'ALTER TABLE "ProductivitySample" ADD COLUMN IF NOT EXISTS "metadata" JSONB'
    );
    await executeGuard(
      'ALTER TABLE "ProductivitySample" ADD COLUMN IF NOT EXISTS "energyLevel" INTEGER'
    );
    await executeGuard(
      'ALTER TABLE "ProductivitySample" ADD COLUMN IF NOT EXISTS "mood" INTEGER'
    );
    await executeGuard(
      'ALTER TABLE "ProductivitySample" ADD COLUMN IF NOT EXISTS "overlapWithUni" BOOLEAN NOT NULL DEFAULT FALSE'
    );
    await executeGuard(
      'ALTER TABLE "ProductivitySample" ADD COLUMN IF NOT EXISTS "success" BOOLEAN NOT NULL DEFAULT FALSE'
    );
    await executeGuard(
      'ALTER TABLE "ProductivitySample" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'
    );
    await executeGuard(
      'ALTER TABLE "ProductivitySample" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'
    );

    await executeGuard(`
      DO $$
      BEGIN
        ALTER TABLE "ProductivitySample"
        ADD CONSTRAINT "ProductivitySample_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
      $$
    `);

    await executeGuard(
      'CREATE INDEX IF NOT EXISTS "ProductivitySample_userId_recordedAt_idx" ON "ProductivitySample" ("userId", "recordedAt")'
    );
    await executeGuard(
      'CREATE INDEX IF NOT EXISTS "ProductivitySample_userId_source_idx" ON "ProductivitySample" ("userId", "sourceType", "sourceId")'
    );

    productivitySchemaEnsured = true;
  } catch (error) {
    logger.warn(
      "Failed to ensure productivity sample schema",
      { error: error instanceof Error ? error.message : String(error) },
      "schema-guard"
    );
  }
}
