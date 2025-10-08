"use client";

import { useMemo } from "react";

import {
  AVATAR_PRESETS,
  DAILY_ACTIVITIES,
  STAT_DEFINITIONS,
  getWeekdayKey,
} from "@/lib/stats-config";
import { newDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

import { StatsAvatar } from "@/components/stats/StatsAvatar";
import { StatsDailyActivities } from "@/components/stats/StatsDailyActivities";
import { StatsHistory } from "@/components/stats/StatsHistory";
import { StatsProgress } from "@/components/stats/StatsProgress";
import { showXpToast } from "@/components/stats/showXpToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { StatKey } from "@/types/stats";

import { useStatsStore } from "@/store/stats";

function getTodayKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function StatsPage() {
  const {
    stats,
    level,
    currentXp,
    xpForNextLevel,
    lifetimeXp,
    history,
    completedDailyActivities,
    currentStreak,
    longestStreak,
    avatarId,
    unlockedAvatarIds,
    setAvatar,
    completeDailyActivity,
  } = useStatsStore((state) => state);

  const today = newDate();
  const weekdayKey = getWeekdayKey(today);
  const todaysActivities = DAILY_ACTIVITIES[weekdayKey] ?? [];
  const todayKey = getTodayKey(today);
  const completedToday = completedDailyActivities[todayKey] ?? [];
  const weekdayLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
  })
    .format(today)
    .replace(/^(\w)/, (match) => match.toUpperCase());

  const statEntries = useMemo(
    () => Object.entries(stats) as Array<[StatKey, number]>,
    [stats]
  );

  const sortedStats = useMemo(
    () => [...statEntries].sort((a, b) => b[1] - a[1]),
    [statEntries]
  );

  const dominantStat = sortedStats[0]?.[0] ?? "focus";
  const activeAvatar = useMemo(() => {
    return (
      AVATAR_PRESETS.find((preset) => preset.id === avatarId) ??
      AVATAR_PRESETS[0]
    );
  }, [avatarId]);

  const handleCompleteActivity = (activityId: string) => {
    const summary = completeDailyActivity(activityId);
    if (summary) {
      showXpToast(summary);
    }
  };

  const handleSelectAvatar = (presetId: string) => {
    setAvatar(presetId);
  };

  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_60%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <Card className="relative overflow-hidden border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="space-y-3 pb-4">
              <CardTitle className="text-3xl font-bold tracking-wide text-white">
                Dein Charakter
              </CardTitle>
              <p className="text-sm text-slate-200/80">
                Sammle XP, forme deine Werte und halte deine Streak am Leben.
              </p>
            </CardHeader>
            <CardContent className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-center">
              <div className="mx-auto flex max-w-xs justify-center">
                <StatsAvatar
                  avatar={activeAvatar}
                  dominantStat={dominantStat}
                  level={level}
                  streak={currentStreak}
                />
              </div>
              <div className="flex flex-col gap-6">
                <StatsProgress
                  currentXp={Math.round(currentXp)}
                  xpForNextLevel={Math.round(xpForNextLevel)}
                  lifetimeXp={Math.round(lifetimeXp)}
                />
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200/80 shadow-inner md:grid-cols-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-200/90">
                      Aktueller Fokus
                    </span>
                    <p className="mt-1 text-sm text-slate-100/90">
                      {STAT_DEFINITIONS[dominantStat].description}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-200/90">
                      Streak
                    </span>
                    <p className="mt-1 text-sm text-slate-100/90">
                      {currentStreak} Tage in Folge · Rekord: {longestStreak} Tage
                    </p>
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300/70">
                    Avatar Loadout
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {AVATAR_PRESETS.map((preset) => {
                      const isUnlocked = unlockedAvatarIds.includes(preset.id);
                      const isActive = preset.id === avatarId;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectAvatar(preset.id)}
                          disabled={!isUnlocked}
                          className={cn(
                            "group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                            isActive && "border-sky-300/70 bg-sky-500/10 shadow-lg",
                            !isUnlocked && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br text-xl text-white",
                              preset.layers.background
                            )}
                          >
                            <span aria-hidden>{STAT_DEFINITIONS[dominantStat].emoji}</span>
                          </div>
                          <div className="flex flex-1 flex-col">
                            <span className="text-sm font-semibold text-white">
                              {preset.label}
                            </span>
                            <span className="text-xs text-slate-200/80">
                              {preset.description}
                            </span>
                          </div>
                          {isActive && (
                            <span className="text-xs text-sky-300">Aktiv</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-semibold text-white">
                Statübersicht
              </CardTitle>
              <p className="text-sm text-slate-200/80">
                Jeder Wert wächst mit deinen passenden Quests.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {sortedStats.map(([key, value]) => {
                const definition = STAT_DEFINITIONS[key];
                const percentage = Math.min(100, value * 5);
                return (
                  <div
                    key={key}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 shadow-lg shadow-black/30"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-1 items-center gap-3">
                        <div
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl",
                            definition.accentColor
                          )}
                        >
                          <span aria-hidden>{definition.emoji}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {definition.label}
                          </p>
                          <p className="text-xs text-slate-200/80">
                            {definition.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-slate-100">
                        {value}
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full bg-gradient-to-r",
                          definition.gradient
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <StatsDailyActivities
            activities={todaysActivities}
            completedIds={completedToday}
            weekdayLabel={weekdayLabel}
            onComplete={handleCompleteActivity}
          />
          <StatsHistory events={history} />
        </div>
      </div>
    </div>
  );
}
