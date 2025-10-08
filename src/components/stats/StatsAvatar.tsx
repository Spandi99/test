"use client";

import { memo } from "react";

import { STAT_DEFINITIONS } from "@/lib/stats-config";
import { cn } from "@/lib/utils";

import { StatKey } from "@/types/stats";

interface StatsAvatarProps {
  dominantStat: StatKey;
  level: number;
  streak: number;
}

export const StatsAvatar = memo(function StatsAvatar({
  dominantStat,
  level,
  streak,
}: StatsAvatarProps) {
  const definition = STAT_DEFINITIONS[dominantStat];
  const streakLabel = streak > 0 ? `${streak} Tage` : "Bereit für den Start";

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        className={cn(
          "relative flex h-48 w-48 items-center justify-center overflow-hidden rounded-full border-4 border-border shadow-xl",
          "bg-gradient-to-br",
          definition.gradient
        )}
      >
        <div className="absolute inset-3 rounded-full bg-background/25 backdrop-blur" />
        <div className="relative flex flex-col items-center gap-2 text-center">
          <span className="text-5xl drop-shadow-lg" aria-hidden>
            {definition.emoji}
          </span>
          <div className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground shadow-sm">
            Level {level}
          </div>
          <span className="text-sm font-medium text-foreground/80">
            {definition.label}
          </span>
        </div>
      </div>
      <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-background px-4 py-1 text-xs font-semibold shadow-lg">
        <span>🔥 Streak</span>
        <span className="text-sm text-primary">{streakLabel}</span>
      </div>
    </div>
  );
});
