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

const EYE_STYLE = {
  base: "bg-black/50",
  highlight: "bg-white/80",
};

function renderHair(style: AvatarOption["layers"]["hairStyle"], color: string) {
  switch (style) {
    case "undercut":
      return (
        <div
          className="absolute -top-1 h-20 w-28 rounded-[2.5rem] bg-gradient-to-b from-black/40 to-transparent"
          style={{ backgroundColor: color }}
        />
      );
    case "braids":
      return (
        <div className="absolute -top-1 flex w-full justify-between px-3">
          {["left", "right"].map((position) => (
            <div
              key={`braid-${position}`}
              className="h-20 w-10 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5), transparent 55%)",
                backgroundColor: color,
              }}
            />
          ))}
        </div>
      );
    case "mohawk":
      return (
        <div
          className="absolute -top-4 h-24 w-10 rounded-full shadow-lg"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(0,0,0,0.2) 80%)",
            backgroundColor: color,
          }}
        />
      );
    case "waves":
    default:
      return (
        <div
          className="absolute -top-2 h-16 w-28 rounded-[2.75rem] shadow-md"
          style={{ backgroundColor: color }}
        />
      );
  }
}

function renderAccessory(
  accessory: AvatarOption["layers"]["accessory"],
  accentColor: string
) {
  switch (accessory) {
    case "visor":
      return (
        <div
          className="absolute top-6 flex w-28 items-center justify-center"
          style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))" }}
        >
          <div
            className="h-4 w-20 rounded-full bg-gradient-to-r from-white/60 via-transparent to-white/60"
            style={{ backgroundColor: accentColor, opacity: 0.85 }}
          />
        </div>
      );
    case "glasses":
      return (
        <div className="absolute top-7 flex w-24 items-center justify-between">
          {["left", "right"].map((side) => (
            <div
              key={`lens-${side}`}
              className="h-8 w-10 rounded-full border-2 border-black/50 bg-white/10"
              style={{ boxShadow: "0 0 12px rgba(56,189,248,0.45) inset" }}
            />
          ))}
        </div>
      );
    case "earrings":
      return (
        <div className="absolute top-16 flex w-32 justify-between px-6">
          {["left", "right"].map((side) => (
            <div
              key={`earring-${side}`}
              className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-200 via-rose-200 to-pink-400"
            />
          ))}
        </div>
      );
    case "hood":
      return (
        <div
          className="absolute -top-4 h-28 w-32 rounded-[2.75rem] border border-white/20 bg-gradient-to-b from-black/60 via-purple-900/70 to-transparent"
          style={{ boxShadow: "0 0 25px rgba(139,92,246,0.45)" }}
        />
      );
    default:
      return null;
  }
}

function renderFaceMark(mark: AvatarOption["layers"]["faceMark"], accentColor: string) {
  switch (mark) {
    case "scar":
      return (
        <div className="absolute left-[55%] top-[48%] h-8 w-[2px] rotate-[20deg] bg-black/15" />
      );
    case "paint":
      return (
        <div
          className="absolute top-[52%] h-3 w-20 rounded-full"
          style={{ backgroundColor: accentColor, opacity: 0.35 }}
        />
      );
    case "freckles":
      return (
        <div className="absolute top-[58%] flex w-16 justify-between text-[6px] text-black/30">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index}>•</span>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function renderCompanion(companion: AvatarOption["layers"]["companion"], accentColor: string) {
  switch (companion) {
    case "drone":
      return (
        <div className="absolute -right-6 top-12 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10">
          <div className="h-12 w-12 rounded-full border border-sky-300/70 bg-slate-900/80" />
          <div className="absolute h-4 w-4 rounded-full bg-sky-200" />
        </div>
      );
    case "spirit":
      return (
        <div className="absolute -left-6 bottom-6 h-16 w-12 animate-pulse rounded-full bg-rose-300/30 blur-sm" />
      );
    case "flare":
      return (
        <div className="absolute -right-4 bottom-10 h-12 w-12 rounded-full bg-gradient-to-br from-amber-300 via-orange-500 to-red-500 opacity-70 blur-md" />
      );
    case "spark":
      return (
        <div className="absolute left-4 -top-4 flex h-12 w-12 items-center justify-center">
          <div
            className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500/40 via-fuchsia-400/50 to-transparent blur-md"
            style={{ boxShadow: `0 0 25px ${accentColor}` }}
          />
        </div>
      );
    default:
      return null;
  }
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
    <div className="relative flex w-full max-w-[13rem] flex-col items-center text-white sm:max-w-[16rem]">
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div
          className={cn(
            "h-60 w-60 rounded-full blur-3xl",
            "bg-gradient-to-br",
            avatar.layers.aura ?? "from-primary/30 via-primary/5 to-transparent"
          )}
        />
      </div>

      <div
        className={cn(
          "relative flex w-full flex-col items-center overflow-visible rounded-[2.25rem] border border-white/10 bg-gradient-to-br p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.75)]",
          avatar.layers.background
        )}
      >
        <div className="absolute inset-0 rounded-[2.25rem] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_70%)]" />
        <div className="relative flex w-full flex-col items-center gap-6 text-center">
          <div className="relative flex w-full justify-center">
            <div className="relative flex h-48 w-32 flex-col items-center justify-start">
              {renderCompanion(avatar.layers.companion, avatar.layers.accentColor)}
              {renderHair(avatar.layers.hairStyle, avatar.layers.hairColor)}
              <div
                className="absolute top-6 flex h-28 w-28 flex-col items-center rounded-[2.5rem] border-4 border-white/40 bg-gradient-to-b from-white via-white/90 to-white/70 shadow-lg"
                style={{ backgroundColor: avatar.layers.skinTone }}
              >
                <div className="mt-5 flex w-[4.25rem] items-center justify-center gap-3">
                  {[0, 1].map((index) => (
                    <div key={index} className="relative h-5 w-5">
                      <span className={cn("absolute inset-0 rounded-full", EYE_STYLE.base)} />
                      <span className={cn("absolute left-1/2 top-1 h-1.5 w-1 rounded-full -translate-x-1/2", EYE_STYLE.highlight)} />
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 h-1 w-12 rounded-full bg-black/10" />
                <div className="mt-3 flex w-20 items-center justify-between">
                  <span
                    className="h-2.5 w-6 rounded-full"
                    style={{ backgroundColor: avatar.layers.accentColor, opacity: 0.3 }}
                  />
                  <span
                    className="h-2.5 w-6 rounded-full"
                    style={{ backgroundColor: avatar.layers.accentColor, opacity: 0.3 }}
                  />
                </div>
                <div className="mt-3.5 h-2 w-14 rounded-full bg-black/15" />
                {renderFaceMark(avatar.layers.faceMark, avatar.layers.accentColor)}
              </div>
              {renderAccessory(avatar.layers.accessory, avatar.layers.accentColor)}
              <div
                className="absolute bottom-0 h-24 w-28 rounded-[2.5rem] border-4 border-white/30 shadow-inner"
                style={{ backgroundColor: avatar.layers.outfitColor }}
              />
              <div
                className="absolute bottom-6 h-4 w-24 rounded-full opacity-90"
                style={{ backgroundColor: avatar.layers.accentColor }}
              />
              {avatar.layers.outfitAccent === "cloak" && (
                <div className="absolute -bottom-2 h-14 w-36 rounded-full bg-gradient-to-br from-rose-200/20 via-transparent to-transparent blur-lg" />
              )}
              {avatar.layers.outfitAccent === "armor" && (
                <div className="absolute bottom-1 h-[4.5rem] w-24 rounded-[2rem] border border-purple-200/20 bg-purple-900/30" />
              )}
              {avatar.layers.outfitAccent === "tech" && (
                <div className="absolute bottom-1 h-[4.25rem] w-[6rem] rounded-[2.1rem] border border-white/20 bg-white/10">
                  <div className="absolute inset-x-6 top-3.5 h-[2px] bg-white/30" />
                  <div className="absolute inset-x-7 top-7 h-[2px] bg-white/20" />
                </div>
              )}
              {avatar.layers.outfitAccent === "street" && (
                <div className="absolute bottom-1 h-[4.5rem] w-[7rem] rounded-[2.1rem] bg-gradient-to-r from-slate-900/40 via-black/20 to-transparent" />
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/80 backdrop-blur">
                Level {level}
              </span>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-lg",
                  "bg-gradient-to-r",
                  definition.gradient
                )}
              >
                <span>{definition.emoji}</span>
                {definition.label}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 px-2 text-center">
              <h3 className="text-lg font-semibold tracking-wide text-white">
                {avatar.label}
              </h3>
              <p className="max-w-[12rem] text-xs text-white/70 sm:max-w-[14rem] sm:text-sm">
                {avatar.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white shadow-[0_20px_40px_-25px_rgba(0,0,0,0.75)] backdrop-blur">
        <span>🔥 Streak</span>
        <span className="text-sm text-primary-200">{streakLabel}</span>
      </div>
    </div>
  );
});
