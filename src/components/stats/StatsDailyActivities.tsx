"use client";

import { Button } from "@/components/ui/button";
import { DailyActivityDefinition } from "@/types/stats";

interface StatsDailyActivitiesProps {
  activities: DailyActivityDefinition[];
  completedIds: string[];
  onComplete: (activityId: string) => void;
  weekdayLabel: string;
}

export function StatsDailyActivities({
  activities,
  completedIds,
  onComplete,
  weekdayLabel,
}: StatsDailyActivitiesProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
        Heute sind keine vorgeschlagenen Aktivitäten hinterlegt.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Tages-Boni ({weekdayLabel})
          </h3>
          <p className="text-sm text-muted-foreground">
            Wähle deine Aktionen aus, um zusätzliche Stat-Ups zu erhalten.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {activities.map((activity) => {
          const isCompleted = completedIds.includes(activity.id);
          return (
            <div
              key={activity.id}
              className="flex flex-col justify-between gap-3 rounded-lg border border-border/70 bg-background/50 p-4 shadow-sm transition hover:border-primary/50 hover:shadow-md md:flex-row md:items-center"
            >
              <div className="flex flex-1 items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                  <span aria-hidden>{activity.emoji}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-semibold text-foreground">
                      {activity.label}
                    </h4>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      +{activity.amount} Stat
                    </span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
                      +{activity.xpReward} XP
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                </div>
              </div>
              <Button
                variant={isCompleted ? "secondary" : "default"}
                disabled={isCompleted}
                onClick={() => onComplete(activity.id)}
                className="md:w-40"
              >
                {isCompleted ? "Erledigt" : "Abschließen"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
