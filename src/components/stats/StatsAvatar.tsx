"use client";

import { memo } from "react";

import { STAT_DEFINITIONS } from "@/lib/stats-config";
import { cn } from "@/lib/utils";

import { AvatarOption, StatKey } from "@/types/stats";

interface StatsAvatarProps {
  avatar: AvatarOption;
  dominantStat: StatKey;
  level: number;
  streak: number;
}

export const StatsAvatar = memo(function StatsAvatar({
  avatar,
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
          "relative flex h-52 w-48 flex-col items-center justify-end overflow-hidden rounded-3xl border-4 border-border shadow-xl",
          "bg-gradient-to-br",
          avatar.layers.background
        )}
      >
        <div className="absolute inset-3 rounded-2xl bg-background/25 backdrop-blur-sm" />
        <div className="relative flex h-full w-full flex-col items-center justify-end gap-3 pb-6 pt-6">
          <div className="relative flex h-28 w-24 flex-col items-center">
            <div
              className="absolute top-0 h-6 w-16 rounded-t-full"
              style={{ backgroundColor: avatar.layers.hairColor }}
            />
            <div
              className="absolute top-4 h-16 w-16 rounded-full border-2 border-white/30"
              style={{ backgroundColor: avatar.layers.skinTone }}
            />
            <div className="absolute top-9 flex w-10 justify-between">
              <span className="h-2 w-2 rounded-full bg-black/50" aria-hidden />
              <span className="h-2 w-2 rounded-full bg-black/50" aria-hidden />
            </div>
            <div className="absolute top-[3.6rem] h-1.5 w-6 rounded-full bg-black/20" aria-hidden />
          </div>
          <div className="relative flex h-24 w-28 items-center justify-center">
            <div
              className="h-full w-full rounded-[2rem] border-2 border-white/40 shadow-inner"
              style={{ backgroundColor: avatar.layers.outfitColor }}
            />
            <div
              className="absolute bottom-5 h-2 w-20 rounded-full"
              style={{ backgroundColor: avatar.layers.accentColor }}
            />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground shadow-sm">
              Level {level}
            </div>
            <span className="text-sm font-semibold text-foreground/90">
              {avatar.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {definition.label}: {definition.description}
            </span>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-background px-4 py-1 text-xs font-semibold shadow-lg">
        <span>🔥 Streak</span>
        <span className="text-sm text-primary">{streakLabel}</span>
      </div>
    </div>
  );
});
