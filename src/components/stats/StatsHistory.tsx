"use client";

import { format } from "date-fns";
import { de } from "date-fns/locale";

import { STAT_DEFINITIONS } from "@/lib/stats-config";

import { StatsEvent } from "@/types/stats";

const SOURCE_LABEL: Record<StatsEvent["source"], string> = {
  task: "Task abgeschlossen",
  daily: "Tagesbonus",
  manual: "Manuelle Belohnung",
};

interface StatsHistoryProps {
  events: StatsEvent[];
}

export function StatsHistory({ events }: StatsHistoryProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
        Noch keine Aktivitäten aufgezeichnet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-foreground">Letzte Ereignisse</h3>
      <div className="flex flex-col gap-3">
        {events.slice(0, 8).map((event) => {
          const date = new Date(event.timestamp);
          return (
            <div
              key={event.id}
              className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/60 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {SOURCE_LABEL[event.source]}
                </span>
                <span className="text-sm text-muted-foreground">{event.label}</span>
                <span className="text-xs text-muted-foreground">
                  {format(date, "EEEE, dd.MM.yyyy HH:mm", { locale: de })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-600 dark:text-amber-300">
                  +{event.xpAwarded} XP
                </span>
                {event.statChanges.map((change) => {
                  const definition = STAT_DEFINITIONS[change.key];
                  return (
                    <span
                      key={`${event.id}-${change.key}`}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                    >
                      {definition.emoji} {definition.label}: +{change.amount} →
                      <span className="text-foreground"> {change.newValue}</span>
                    </span>
                  );
                })}
                {event.leveledUp && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Level Up! {event.previousLevel} → {event.newLevel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
