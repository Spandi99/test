import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  BASE_TASK_XP,
  DAILY_ACTIVITIES,
  MAX_TASK_XP_BONUS,
  TASK_KEYWORD_MAP,
  XP_PER_ESTIMATED_MINUTE,
  getWeekdayKey,
  getXpForLevel,
} from "@/lib/stats-config";
import { newDate } from "@/lib/date-utils";

import { EnergyLevel, Priority, Task } from "@/types/task";
import {
  DailyActivityDefinition,
  GainSummary,
  StatChange,
  StatKey,
  StatsEvent,
} from "@/types/stats";

interface StatsState {
  level: number;
  currentXp: number;
  xpForNextLevel: number;
  lifetimeXp: number;
  stats: Record<StatKey, number>;
  history: StatsEvent[];
  completedDailyActivities: Record<string, string[]>;
  lastProgressDate?: string;
  currentStreak: number;
  longestStreak: number;

  awardTaskCompletion: (task: Task) => GainSummary;
  completeDailyActivity: (activityId: string) => GainSummary | null;
  awardManualXp: (
    amount: number,
    label: string,
    statKey?: StatKey,
    statAmount?: number
  ) => GainSummary;
  adjustStat: (key: StatKey, amount: number) => StatChange;
  resetDailyCompletion: (date?: Date) => void;
}

const INITIAL_STATS: Record<StatKey, number> = {
  focus: 10,
  endurance: 8,
  creativity: 8,
  social: 8,
  wellbeing: 9,
};

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function pruneDailyRecords(
  records: Record<string, string[]>,
  keepDays = 21
): Record<string, string[]> {
  const entries = Object.entries(records).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  if (entries.length <= keepDays) return records;
  const trimmed = entries.slice(entries.length - keepDays);
  return Object.fromEntries(trimmed);
}

function calculateTaskXp(task: Task): number {
  const durationMinutes = task.duration ?? 0;
  const durationBonus = Math.min(
    MAX_TASK_XP_BONUS,
    Math.round(durationMinutes * XP_PER_ESTIMATED_MINUTE)
  );
  const priorityBonus = task.priority === Priority.HIGH ? 15 : 0;
  const statusBonus = task.energyLevel === EnergyLevel.HIGH ? 10 : 0;
  return BASE_TASK_XP + durationBonus + priorityBonus + statusBonus;
}

function inferStatFromTask(task: Task): StatKey {
  const haystack = [
    task.title,
    task.description ?? "",
    ...task.tags.map((tag) => tag.name ?? ""),
  ].join(" ");

  for (const entry of TASK_KEYWORD_MAP) {
    if (entry.patterns.some((pattern) => pattern.test(haystack))) {
      return entry.statKey;
    }
  }

  switch (task.energyLevel) {
    case EnergyLevel.HIGH:
      return "endurance";
    case EnergyLevel.LOW:
      return "wellbeing";
    default:
      return "focus";
  }
}

function getStatGainForTask(task: Task): number {
  const durationMinutes = task.duration ?? 0;
  if (durationMinutes >= 120) return 3;
  if (durationMinutes >= 60) return 2;
  return 1;
}

function findActivityForToday(
  activityId: string,
  todayActivities: DailyActivityDefinition[]
): DailyActivityDefinition | undefined {
  return todayActivities.find((activity) => activity.id === activityId);
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => {
      const recordGain = (
        amount: number,
        label: string,
        source: GainSummary["source"],
        statChanges: StatChange[] = []
      ): GainSummary => {
        const state = get();
        const timestamp = newDate().toISOString();
        const previousLevel = state.level;
        const previousXp = state.currentXp;

        let xpPool = state.currentXp + amount;
        let level = state.level;
        let xpForNext = state.xpForNextLevel;
        let leveledUp = false;

        while (xpPool >= xpForNext) {
          xpPool -= xpForNext;
          level += 1;
          xpForNext = getXpForLevel(level);
          leveledUp = true;
        }

        const dateKey = timestamp.split("T")[0];
        let currentStreak = state.currentStreak;

        if (!state.lastProgressDate) {
          currentStreak = 1;
        } else if (state.lastProgressDate === dateKey) {
          currentStreak = Math.max(state.currentStreak, 1);
        } else {
          const last = new Date(state.lastProgressDate);
          const current = new Date(dateKey);
          const diff = Math.round(
            (current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diff === 1) {
            currentStreak = state.currentStreak + 1;
          } else if (diff <= 0) {
            currentStreak = Math.max(state.currentStreak, 1);
          } else {
            currentStreak = 1;
          }
        }

        const longestStreak = Math.max(state.longestStreak, currentStreak);

        const summary: GainSummary = {
          source,
          label,
          xpAwarded: amount,
          previousLevel,
          newLevel: level,
          previousXp,
          newXp: xpPool,
          xpForNextLevel: xpForNext,
          leveledUp,
          statChanges,
          timestamp,
        };

        const historyEntry: StatsEvent = {
          id: generateId(),
          ...summary,
        };

        set({
          level,
          currentXp: xpPool,
          xpForNextLevel: xpForNext,
          lifetimeXp: state.lifetimeXp + amount,
          history: [historyEntry, ...state.history].slice(0, 60),
          lastProgressDate: dateKey,
          currentStreak,
          longestStreak,
        });

        return summary;
      };

      return {
        level: 1,
        currentXp: 0,
        xpForNextLevel: getXpForLevel(1),
        lifetimeXp: 0,
        stats: INITIAL_STATS,
        history: [],
        completedDailyActivities: {},
        lastProgressDate: undefined,
        currentStreak: 0,
        longestStreak: 0,

        adjustStat: (key, amount) => {
          const state = get();
          const currentValue = state.stats[key] ?? 0;
          const newValue = Math.max(0, currentValue + amount);
          set({
            stats: {
              ...state.stats,
              [key]: newValue,
            },
          });
          return { key, amount, newValue };
        },

        awardTaskCompletion: (task) => {
          const statKey = inferStatFromTask(task);
          const statAmount = getStatGainForTask(task);
          const statChange = get().adjustStat(statKey, statAmount);
          const xp = calculateTaskXp(task);
          return recordGain(xp, task.title, "task", [statChange]);
        },

        completeDailyActivity: (activityId) => {
          const today = newDate();
          const todayKey = formatDateKey(today);
          const weekdayKey = getWeekdayKey(today);
          const todayActivities = DAILY_ACTIVITIES[weekdayKey] ?? [];
          const activity = findActivityForToday(activityId, todayActivities);

          if (!activity) {
            return null;
          }

          const completed = get().completedDailyActivities[todayKey] ?? [];
          if (completed.includes(activityId)) {
            return null;
          }

          const statChange = get().adjustStat(activity.statKey, activity.amount);

          const updatedRecords = {
            ...get().completedDailyActivities,
            [todayKey]: [...completed, activityId],
          };

          set({ completedDailyActivities: pruneDailyRecords(updatedRecords) });

          return recordGain(activity.xpReward, activity.label, "daily", [statChange]);
        },

        awardManualXp: (amount, label, statKey, statAmount = 0) => {
          const statChanges: StatChange[] = [];
          if (statKey && statAmount !== 0) {
            const change = get().adjustStat(statKey, statAmount);
            statChanges.push(change);
          }
          return recordGain(amount, label, "manual", statChanges);
        },

        resetDailyCompletion: (date) => {
          if (!date) {
            set({ completedDailyActivities: {} });
            return;
          }
          const key = formatDateKey(date);
          const records = { ...get().completedDailyActivities };
          delete records[key];
          set({ completedDailyActivities: records });
        },
      };
    },
    {
      name: "stats-store",
      version: 1,
    }
  )
);
