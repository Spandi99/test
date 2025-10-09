import { Prisma } from "@prisma/client";

import {
  buildEventMetadata,
  normalizeIncomingFlags,
} from "@/lib/calendar-metadata";

describe("normalizeIncomingFlags", () => {
  it("returns undefined when flags were not provided", () => {
    expect(normalizeIncomingFlags(undefined)).toBeUndefined();
  });

  it("normalizes valid flags and removes duplicates", () => {
    expect(
      normalizeIncomingFlags([
        "fixed",
        "flexible",
        "flexible",
        "conditional-learning",
        "unknown",
      ])
    ).toEqual(["fixed", "flexible", "conditional-learning"]);
  });

  it("treats null or invalid payloads as an explicit empty list", () => {
    expect(normalizeIncomingFlags(null)).toEqual([]);
    expect(normalizeIncomingFlags("fixed")).toEqual([]);
  });
});

describe("buildEventMetadata", () => {
  it("applies sanitized flags overrides when provided", () => {
    const metadata = buildEventMetadata({
      existing: { flags: ["fixed"], tags: [] },
      incoming: { energyLevel: 3 },
      tags: [],
      flags: ["dopamine"],
      feedType: "LOCAL",
    });

    expect((metadata as Prisma.JsonObject).flags).toEqual(["dopamine"]);
    expect((metadata as Prisma.JsonObject).energyLevel).toBe(3);
  });

  it("filters invalid flags from existing payloads when no override provided", () => {
    const metadata = buildEventMetadata({
      existing: { flags: ["fixed", "invalid"] },
      incoming: {
        flags: ["conditional-learning", 42] as unknown,
      } as unknown as Prisma.InputJsonObject,
      feedType: "LOCAL",
    });

    expect((metadata as Prisma.JsonObject).flags).toEqual([
      "conditional-learning",
    ]);
  });
});
