"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { getXpForLevel, STAT_DEFINITIONS } from "@/lib/stats-config";

import { GainSummary } from "@/types/stats";

function XpToast({ summary }: { summary: GainSummary }) {
  const previousTarget = getXpForLevel(summary.previousLevel);
  const beforePercent = Math.min(
    100,
    Math.round((summary.previousXp / previousTarget) * 100)
  );
  const afterPercent = Math.min(
    100,
    Math.round((summary.newXp / summary.xpForNextLevel) * 100)
  );
  const [progress, setProgress] = useState(beforePercent);

  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(afterPercent));
    return () => cancelAnimationFrame(id);
  }, [afterPercent]);

  return (
    <div className="w-80 rounded-lg border border-border bg-background/95 p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            +{summary.xpAwarded} XP
          </p>
          <p className="text-sm font-semibold text-foreground">{summary.label}</p>
          <p className="text-xs text-muted-foreground">
            Level {summary.previousLevel} → {summary.newLevel}
          </p>
        </div>
        {summary.leveledUp && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            Level Up!
          </span>
        )}
      </div>
      {summary.hypeText && (
        <p className="mt-2 text-xs font-semibold text-primary/80">
          {summary.hypeText}
        </p>
      )}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary via-sky-500 to-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {summary.statChanges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.statChanges.map((change) => {
            const definition = STAT_DEFINITIONS[change.key];
            return (
              <span
                key={`${summary.timestamp}-${change.key}`}
                className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {definition.emoji} {definition.label} +{change.amount}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function showXpToast(summary: GainSummary) {
  toast.custom(() => <XpToast summary={summary} />, {
    duration: 4000,
    position: "top-center",
  });
}
