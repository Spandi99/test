"use client";

import { cn } from "@/lib/utils";

interface StatsProgressProps {
  currentXp: number;
  xpForNextLevel: number;
  lifetimeXp: number;
}

export function StatsProgress({
  currentXp,
  xpForNextLevel,
  lifetimeXp,
}: StatsProgressProps) {
  const progress = Math.min(100, Math.round((currentXp / xpForNextLevel) * 100));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Erfahrung</span>
        <span>
          {currentXp} / {xpForNextLevel} XP
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-sky-500 to-violet-500 transition-all",
            "shadow-[0_0_16px_rgba(59,130,246,0.35)]"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        Insgesamt gesammelt: <span className="font-semibold text-foreground">{lifetimeXp} XP</span>
      </div>
    </div>
  );
}
