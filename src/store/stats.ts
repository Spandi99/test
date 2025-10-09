import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  AVATAR_PRESETS,
  BASE_EVENT_XP,
  BASE_TASK_XP,
  DAILY_ACTIVITIES,
  EVENT_XP_PER_HOUR,
  MAX_EVENT_XP_BONUS,
  MAX_TASK_XP_BONUS,
  TAG_BONUS_DEFINITIONS,
  TASK_KEYWORD_MAP,
  XP_PER_ESTIMATED_MINUTE,
  getWeekdayKey,
  getXpForLevel,
} from "@/lib/stats-config";
import { getProgressionTag } from "@/lib/progression-tags";
import { newDate } from "@/lib/date-utils";

import { EnergyLevel, Priority, Task } from "@/types/task";
import {
  DailyActivityDefinition,
  GainSummary,
  StatChange,
  StatKey,
  StatsEvent,
  TagBonusDefinition,
} from "@/types/stats";
import { CalendarEvent } from "@/types/calendar";

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
  avatarId: string;
  unlockedAvatarIds: string[];
  avatarFinalized: boolean;

  awardTaskCompletion: (task: Task) => GainSummary;
  awardEventCompletion: (event: CalendarEvent) => GainSummary;
  completeDailyActivity: (activityId: string) => GainSummary | null;
  awardManualXp: (
    amount: number,
    label: string,
    statKey?: StatKey,
    statAmount?: number
  ) => GainSummary;
  adjustStat: (key: StatKey, amount: number) => StatChange;
  resetDailyCompletion: (date?: Date) => void;
  setAvatar: (avatarId: string) => void;
  finalizeAvatar: (avatarId: string) => void;
  unlockAvatar: (avatarId: string) => void;
}

const INITIAL_STATS: Record<StatKey, number> = {
  focus: 10,
  endurance: 8,
  creativity: 8,
  social: 8,
  wellbeing: 9,
};

const DEFAULT_AVATAR_ID = AVATAR_PRESETS[0]?.id ?? "trailblazer";
const INITIAL_UNLOCKED_AVATARS = AVATAR_PRESETS.map((preset) => preset.id);

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

function inferStatFromContent(content: string): StatKey | null {
  for (const entry of TASK_KEYWORD_MAP) {
    if (entry.patterns.some((pattern) => pattern.test(content))) {
      return entry.statKey;
    }
  }
  return null;
}

function getMatchingTagDefinitions<T extends { name?: string }>(
  tags: T[] | undefined
): TagBonusDefinition[] {
  if (!tags || tags.length === 0) {
    return [];
  }

  const matches = new Map<string, TagBonusDefinition>();

  for (const tag of tags) {
    const normalized = (tag.name ?? "").toLowerCase();
    if (!normalized) continue;
    for (const definition of TAG_BONUS_DEFINITIONS) {
      if (definition.patterns.some((pattern) => pattern.test(normalized))) {
        matches.set(definition.id, definition);
      }
    }
  }

  return Array.from(matches.values());
}

function inferStatFromTask(task: Task): StatKey {
  const metadata = (task.metadata as Record<string, unknown> | null) ?? null;
  const progressionTagId = metadata?.progressionTagId as string | undefined;
  const progressionTag = getProgressionTag(progressionTagId);
  if (progressionTag) {
    return progressionTag.statKey;
  }
  const tagMatch = getMatchingTagDefinitions(task.tags)[0];
  if (tagMatch) {
    return tagMatch.statKey;
  }

  const haystack = [
    task.title,
    task.description ?? "",
    ...task.tags.map((tag) => tag.name ?? ""),
  ].join(" ");

  const keywordStat = inferStatFromContent(haystack);
  if (keywordStat) {
    return keywordStat;
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

function applyTagBonuses<T extends { name?: string }>(
  tags: T[] | undefined,
  adjust: (key: StatKey, amount: number) => StatChange
) : { statChanges: StatChange[]; xpBonus: number; hypeText?: string } {
  const matches = getMatchingTagDefinitions(tags);
  if (matches.length === 0) {
    return { statChanges: [], xpBonus: 0, hypeText: undefined };
  }

  const statChanges = matches.map((match) => adjust(match.statKey, match.statAmount));
  const xpBonus = matches.reduce((total, match) => total + match.xpBonus, 0);
  const hypeText = matches.map((match) => match.hypeText).join(" · ");

  return { statChanges, xpBonus, hypeText };
}

function collectEventTags(event: CalendarEvent) {
  const metadataTags = Array.isArray(event.metadata?.tags)
    ? event.metadata?.tags
    : [];
  const extendedTags = Array.isArray(event.extendedProps?.tags)
    ? event.extendedProps?.tags
    : [];
  return [...metadataTags, ...extendedTags];
}

function inferStatFromEvent(event: CalendarEvent): StatKey {
  const metadata = event.metadata as Record<string, unknown> | null;
  const progressionTagId = metadata?.progressionTagId as string | undefined;
  const progressionTag = getProgressionTag(progressionTagId);
  if (progressionTag) {
    return progressionTag.statKey;
  }
  const tagMatch = getMatchingTagDefinitions(collectEventTags(event))[0];
  if (tagMatch) {
    return tagMatch.statKey;
  }

  const keywordStat = inferStatFromContent(
    `${event.title ?? ""} ${event.description ?? ""}`
  );
  if (keywordStat) {
    return keywordStat;
  }

  return "focus";
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
        statChanges: StatChange[] = [],
        hypeText?: string
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
          hypeText,
        };

        const historyEntry: StatsEvent = {
          ...summary,
          id: generateId(),
        };

        const updatedUnlocked = new Set(state.unlockedAvatarIds);
        if (leveledUp) {
          if (level >= 3) {
            updatedUnlocked.add("focus-prodigy");
          }
          if (level >= 6) {
            updatedUnlocked.add("creative-spark");
          }
          if (level >= 9) {
            updatedUnlocked.add("night-owl");
          }
        }

        set({
          level,
          currentXp: xpPool,
          xpForNextLevel: xpForNext,
          lifetimeXp: state.lifetimeXp + amount,
          history: [historyEntry, ...state.history].slice(0, 60),
          lastProgressDate: dateKey,
          currentStreak,
          longestStreak,
          unlockedAvatarIds: Array.from(updatedUnlocked),
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
        avatarId: DEFAULT_AVATAR_ID,
        unlockedAvatarIds: INITIAL_UNLOCKED_AVATARS,
        avatarFinalized: false,

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
          const statChanges: StatChange[] = [
            get().adjustStat(statKey, statAmount),
          ];
          const tagResult = applyTagBonuses(task.tags, get().adjustStat);
          if (tagResult.statChanges.length > 0) {
            statChanges.push(...tagResult.statChanges);
          }
          const xp = calculateTaskXp(task) + tagResult.xpBonus;
          return recordGain(xp, task.title, "task", statChanges, tagResult.hypeText);
        },

        awardEventCompletion: (event) => {
          const start = newDate(event.start);
          const end = event.end ? newDate(event.end) : newDate(event.start);
          let durationMinutes = Math.max(
            30,
            Math.round(Math.abs(end.getTime() - start.getTime()) / 60000)
          );
          if (!Number.isFinite(durationMinutes)) {
            durationMinutes = 30;
          }

          const statKey = inferStatFromEvent(event);
          const baseStatAmount =
            durationMinutes >= 180 ? 3 : durationMinutes >= 90 ? 2 : 1;

          const statChanges: StatChange[] = [
            get().adjustStat(statKey, baseStatAmount),
          ];

          const tagResult = applyTagBonuses(
            collectEventTags(event),
            get().adjustStat
          );
          if (tagResult.statChanges.length > 0) {
            statChanges.push(...tagResult.statChanges);
          }

          const durationBonus = Math.min(
            MAX_EVENT_XP_BONUS,
            Math.round((durationMinutes / 60) * EVENT_XP_PER_HOUR)
          );
          const xp = BASE_EVENT_XP + durationBonus + tagResult.xpBonus;
          const label = event.title || "Kalendereintrag";

          return recordGain(
            xp,
            label,
            "event",
            statChanges,
            tagResult.hypeText
          );
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

        setAvatar: (avatarId) => {
          if (get().avatarFinalized) {
            return;
          }
          const exists = AVATAR_PRESETS.some((preset) => preset.id === avatarId);
          if (!exists) return;
          const state = get();
          if (
            !state.unlockedAvatarIds.includes(avatarId) ||
            state.avatarId === avatarId
          ) {
            return;
          }
          set({ avatarId });
        },

        finalizeAvatar: (avatarId) => {
          const exists = AVATAR_PRESETS.some((preset) => preset.id === avatarId);
          if (!exists) return;
          const state = get();
          if (!state.unlockedAvatarIds.includes(avatarId)) {
            return;
          }
          set({ avatarId, avatarFinalized: true });
        },

        unlockAvatar: (avatarId) => {
          const exists = AVATAR_PRESETS.some((preset) => preset.id === avatarId);
          if (!exists) return;
          const state = get();
          if (state.unlockedAvatarIds.includes(avatarId)) {
            return;
          }
          set({
            unlockedAvatarIds: [...state.unlockedAvatarIds, avatarId],
          });
        },
      };
    },
    {
      name: "stats-store",
      version: 3,
      migrate: async (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as StatsState;
        }
        if (version < 3) {
          return {
            avatarFinalized: false,
            ...persistedState,
          } as StatsState;
        }
        return persistedState as StatsState;
      },
    }
  )
);
