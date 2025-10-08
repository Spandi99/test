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
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 pb-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-3xl font-bold text-foreground">
                Dein Charakter
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Level dich hoch, indem du Aufgaben und Tagesrituale abschließt.
              </p>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
              <div className="flex justify-center lg:justify-start">
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
                <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground md:grid-cols-2">
                  <div>
                    <span className="font-semibold text-foreground">Aktueller Fokus</span>
                    <p>{STAT_DEFINITIONS[dominantStat].description}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Streak</p>
                    <p>
                      {currentStreak} Tage in Folge · Bester Lauf: {longestStreak} Tage
                    </p>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Avatar auswählen
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
                            "flex items-center gap-3 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary",
                            isActive
                              ? "border-primary/60 bg-primary/10"
                              : "border-border/60 bg-background hover:border-primary/40",
                            !isUnlocked && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <div
                            className={cn(
                              "h-10 w-10 rounded-full border-2 border-white/60 shadow-inner",
                              "bg-gradient-to-br",
                              preset.layers.background
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">
                              {preset.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {preset.description}
                            </span>
                          </div>
                          {!isUnlocked && (
                            <span className="ml-auto text-xs text-muted-foreground" aria-hidden>
                              🔒
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-semibold">
                Statübersicht
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Jeder Wert wächst mit den passenden Aktivitäten.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {sortedStats.map(([key, value]) => {
                const definition = STAT_DEFINITIONS[key];
                const percentage = Math.min(100, value * 5);
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-border/70 bg-background/60 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xl">
                          <span aria-hidden>{definition.emoji}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {definition.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {definition.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-foreground">
                        {Math.round(value)}
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/80 via-primary to-primary/60"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <StatsDailyActivities
              activities={todaysActivities}
              completedIds={completedToday}
              onComplete={handleCompleteActivity}
              weekdayLabel={weekdayLabel}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <StatsHistory events={history} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
