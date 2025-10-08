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

const FACE_ACCENTS = {
  eyes: "bg-black/40",
  smile: "bg-black/20",
  blush: "bg-red-400/25",
};

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
          "relative flex w-64 flex-col items-center overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br shadow-2xl",
          avatar.layers.background
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_55%)]" />
        <div className="relative flex w-full flex-col items-center gap-6 px-6 pb-8 pt-10">
          <div className="relative flex h-36 w-full items-end justify-center">
            <div className="relative flex h-36 w-32 flex-col items-center justify-start">
              <div
                className="absolute top-0 h-16 w-28 rounded-[2.5rem] shadow-lg"
                style={{ backgroundColor: avatar.layers.hairColor }}
              />
              <div
                className="absolute top-3 flex h-28 w-28 flex-col items-center rounded-[2.25rem] border-4 border-white/60 bg-gradient-to-br from-white/95 via-white/90 to-white/60 shadow-lg"
                style={{
                  backgroundColor: avatar.layers.skinTone,
                  borderColor: avatar.layers.skinTone,
                }}
              >
                <div className="mt-6 flex w-16 items-center justify-between">
                  <span className={cn("h-2 w-2 rounded-full", FACE_ACCENTS.eyes)} />
                  <span className={cn("h-2 w-2 rounded-full", FACE_ACCENTS.eyes)} />
                </div>
                <div className="mt-3 h-1.5 w-10 rounded-full bg-black/15" />
                <div className="mt-2 flex w-20 justify-between">
                  <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: avatar.layers.accentColor, opacity: 0.2 }} />
                  <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: avatar.layers.accentColor, opacity: 0.2 }} />
                </div>
                <div
                  className={cn(
                    "mt-4 h-2 w-12 rounded-full",
                    FACE_ACCENTS.smile
                  )}
                />
              </div>
              <div
                className="absolute bottom-0 h-24 w-32 rounded-[2.5rem] border-4 border-white/40 shadow-inner"
                style={{ backgroundColor: avatar.layers.outfitColor }}
              />
              <div
                className="absolute bottom-5 h-3 w-24 rounded-full opacity-80"
                style={{ backgroundColor: avatar.layers.accentColor }}
              />
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/80 shadow-sm">
                Level {level}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                {definition.label}
              </span>
            </div>
            <span className="text-lg font-semibold text-foreground/90">
              {avatar.label}
            </span>
            <p className="max-w-[16rem] text-sm text-muted-foreground">
              {definition.description}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-background/90 px-4 py-1.5 text-xs font-semibold shadow-xl">
        <span>🔥 Streak</span>
        <span className="text-sm text-primary">{streakLabel}</span>
      </div>
    </div>
  );
});
