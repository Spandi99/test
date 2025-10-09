import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  AVATAR_PRESETS,
  DAILY_ACTIVITIES,
  EVENT_XP_PER_HOUR,
  MIN_EVENT_XP,
  MIN_TASK_XP,
  TAG_BONUS_DEFINITIONS,
  TASK_KEYWORD_MAP,
  TASK_XP_PER_HOUR,
  getWeekdayKey,
  getXpForLevel,
} from "@/lib/stats-config";
import { getProgressionTag } from "@/lib/progression-tags";
import { newDate } from "@/lib/date-utils";

import { EnergyLevel, Task } from "@/types/task";
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
  activeProfileId: string;
  profiles: Record<string, StatsProfile>;

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
  switchProfile: (userId?: string | null) => void;
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

type StatsProfile = {
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
};

const DEFAULT_PROFILE_KEY = "__local__";

function createDefaultProfile(): StatsProfile {
  return {
    level: 1,
    currentXp: 0,
    xpForNextLevel: getXpForLevel(1),
    lifetimeXp: 0,
    stats: { ...INITIAL_STATS },
    history: [],
    completedDailyActivities: {},
    lastProgressDate: undefined,
    currentStreak: 0,
    longestStreak: 0,
    avatarId: DEFAULT_AVATAR_ID,
    unlockedAvatarIds: [...INITIAL_UNLOCKED_AVATARS],
    avatarFinalized: false,
  };
}

function cloneProfile(profile: StatsProfile): StatsProfile {
  return {
    ...profile,
    stats: { ...profile.stats },
    history: profile.history.map((entry) => ({ ...entry })),
    completedDailyActivities: Object.fromEntries(
      Object.entries(profile.completedDailyActivities).map(([key, value]) => [
        key,
        [...value],
      ])
    ),
    unlockedAvatarIds: [...profile.unlockedAvatarIds],
  };
}

function projectProfile(profile: StatsProfile) {
  return {
    level: profile.level,
    currentXp: profile.currentXp,
    xpForNextLevel: profile.xpForNextLevel,
    lifetimeXp: profile.lifetimeXp,
    stats: profile.stats,
    history: profile.history,
    completedDailyActivities: profile.completedDailyActivities,
    lastProgressDate: profile.lastProgressDate,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    avatarId: profile.avatarId,
    unlockedAvatarIds: profile.unlockedAvatarIds,
    avatarFinalized: profile.avatarFinalized,
  };
}

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
  const scheduledStart = task.scheduledStart
    ? newDate(task.scheduledStart)
    : null;
  const scheduledEnd = task.scheduledEnd ? newDate(task.scheduledEnd) : null;
  let durationMinutes = 0;

  if (scheduledStart && scheduledEnd) {
    durationMinutes = Math.round(
      Math.abs(scheduledEnd.getTime() - scheduledStart.getTime()) / 60000
    );
  } else if (typeof task.duration === "number") {
    durationMinutes = task.duration;
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    durationMinutes = 30;
  }

  const normalizedMinutes = Math.max(30, durationMinutes);
  const xp = Math.round((normalizedMinutes / 60) * TASK_XP_PER_HOUR);
  return Math.max(MIN_TASK_XP, xp);
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
      const mutateActiveProfile = (
        mutator: (profile: StatsProfile) => StatsProfile
      ) => {
        const key = get().activeProfileId ?? DEFAULT_PROFILE_KEY;
        const profiles = get().profiles;
        const current = profiles[key] ?? createDefaultProfile();
        const nextProfile = mutator(cloneProfile(current));
        set((state) => ({
          activeProfileId: key,
          profiles: { ...state.profiles, [key]: nextProfile },
          ...projectProfile(nextProfile),
        }));
        return nextProfile;
      };

      const recordGain = (
        amount: number,
        label: string,
        source: GainSummary["source"],
        statChanges: StatChange[] = [],
        hypeText?: string
      ): GainSummary => {
        let summary: GainSummary | undefined;
        mutateActiveProfile((profile) => {
          const timestamp = newDate().toISOString();
          const previousLevel = profile.level;
          const previousXp = profile.currentXp;

          let xpPool = profile.currentXp + amount;
          let level = profile.level;
          let xpForNext = profile.xpForNextLevel;
          let leveledUp = false;

          while (xpPool >= xpForNext) {
            xpPool -= xpForNext;
            level += 1;
            xpForNext = getXpForLevel(level);
            leveledUp = true;
          }

          const dateKey = timestamp.split("T")[0];
          let currentStreak = profile.currentStreak;

          if (!profile.lastProgressDate) {
            currentStreak = 1;
          } else if (profile.lastProgressDate === dateKey) {
            currentStreak = Math.max(profile.currentStreak, 1);
          } else {
            const last = new Date(profile.lastProgressDate);
            const current = new Date(dateKey);
            const diff = Math.round(
              (current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (diff === 1) {
              currentStreak = profile.currentStreak + 1;
            } else if (diff <= 0) {
              currentStreak = Math.max(profile.currentStreak, 1);
            } else {
              currentStreak = 1;
            }
          }

          const longestStreak = Math.max(profile.longestStreak, currentStreak);

          summary = {
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

          const updatedUnlocked = new Set(profile.unlockedAvatarIds);
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

          profile.level = level;
          profile.currentXp = xpPool;
          profile.xpForNextLevel = xpForNext;
          profile.lifetimeXp += amount;
          profile.history = [historyEntry, ...profile.history].slice(0, 60);
          profile.lastProgressDate = dateKey;
          profile.currentStreak = currentStreak;
          profile.longestStreak = longestStreak;
          profile.unlockedAvatarIds = Array.from(updatedUnlocked);

          return profile;
        });

        return summary!;
      };

      const initialProfile = createDefaultProfile();

      return {
        ...projectProfile(initialProfile),
        activeProfileId: DEFAULT_PROFILE_KEY,
        profiles: { [DEFAULT_PROFILE_KEY]: initialProfile },

        switchProfile: (userId?: string | null) => {
          const key =
            userId && userId.trim().length > 0
              ? userId.trim()
              : DEFAULT_PROFILE_KEY;
          const profiles = get().profiles;
          const profile = profiles[key] ?? createDefaultProfile();
          set((state) => ({
            activeProfileId: key,
            profiles: { ...state.profiles, [key]: profile },
            ...projectProfile(profile),
          }));
        },

        adjustStat: (key, amount) => {
          let change: StatChange = { key, amount, newValue: 0 };
          mutateActiveProfile((profile) => {
            const currentValue = profile.stats[key] ?? 0;
            const newValue = Math.max(0, currentValue + amount);
            profile.stats = { ...profile.stats, [key]: newValue };
            change = { key, amount, newValue };
            return profile;
          });
          return change;
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
          return recordGain(
            xp,
            task.title,
            "task",
            statChanges,
            tagResult.hypeText
          );
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

          const baseXp = Math.max(
            MIN_EVENT_XP,
            Math.round((durationMinutes / 60) * EVENT_XP_PER_HOUR)
          );
          const xp = baseXp + tagResult.xpBonus;
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

          const state = get();
          const profileKey = state.activeProfileId ?? DEFAULT_PROFILE_KEY;
          const profile = state.profiles[profileKey] ?? createDefaultProfile();
          const completed = profile.completedDailyActivities[todayKey] ?? [];
          if (completed.includes(activityId)) {
            return null;
          }

          const statChange = state.adjustStat(activity.statKey, activity.amount);

          const updatedRecords = {
            ...profile.completedDailyActivities,
            [todayKey]: [...completed, activityId],
          };

          mutateActiveProfile((current) => {
            current.completedDailyActivities =
              pruneDailyRecords(updatedRecords);
            return current;
          });

          return recordGain(activity.xpReward, activity.label, "daily", [
            statChange,
          ]);
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
            mutateActiveProfile((profile) => {
              profile.completedDailyActivities = {};
              return profile;
            });
            return;
          }
          const key = formatDateKey(date);
          mutateActiveProfile((profile) => {
            const records = { ...profile.completedDailyActivities };
            delete records[key];
            profile.completedDailyActivities = records;
            return profile;
          });
        },

        setAvatar: (avatarId) => {
          const state = get();
          if (state.avatarFinalized) {
            return;
          }
          const exists = AVATAR_PRESETS.some((preset) => preset.id === avatarId);
          if (!exists) return;
          const profileKey = state.activeProfileId ?? DEFAULT_PROFILE_KEY;
          const profile = state.profiles[profileKey] ?? createDefaultProfile();
          if (
            !profile.unlockedAvatarIds.includes(avatarId) ||
            profile.avatarId === avatarId
          ) {
            return;
          }
          mutateActiveProfile((current) => {
            current.avatarId = avatarId;
            return current;
          });
        },

        finalizeAvatar: (avatarId) => {
          const exists = AVATAR_PRESETS.some((preset) => preset.id === avatarId);
          if (!exists) return;
          const state = get();
          const profileKey = state.activeProfileId ?? DEFAULT_PROFILE_KEY;
          const profile = state.profiles[profileKey] ?? createDefaultProfile();
          if (!profile.unlockedAvatarIds.includes(avatarId)) {
            return;
          }
          mutateActiveProfile((current) => {
            current.avatarId = avatarId;
            current.avatarFinalized = true;
            return current;
          });
        },

        unlockAvatar: (avatarId) => {
          const exists = AVATAR_PRESETS.some((preset) => preset.id === avatarId);
          if (!exists) return;
          mutateActiveProfile((profile) => {
            if (profile.unlockedAvatarIds.includes(avatarId)) {
              return profile;
            }
            profile.unlockedAvatarIds = [
              ...profile.unlockedAvatarIds,
              avatarId,
            ];
            return profile;
          });
        },
        };

      },
    {
      name: "stats-store",
      version: 4,
      migrate: async (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as StatsState;
        }

        const draft = persistedState as Partial<StatsState> & {
          profiles?: Record<string, StatsProfile>;
        };

        if (version < 3) {
          draft.avatarFinalized = draft.avatarFinalized ?? false;
        }

        if (!draft.profiles) {
          const profile = createDefaultProfile();
          profile.level = draft.level ?? profile.level;
          profile.currentXp = draft.currentXp ?? profile.currentXp;
          profile.xpForNextLevel =
            draft.xpForNextLevel ?? getXpForLevel(profile.level);
          profile.lifetimeXp = draft.lifetimeXp ?? profile.lifetimeXp;
          profile.stats = { ...INITIAL_STATS, ...(draft.stats ?? {}) };
          profile.history = draft.history ?? [];
          profile.completedDailyActivities =
            draft.completedDailyActivities ?? {};
          profile.lastProgressDate = draft.lastProgressDate ?? undefined;
          profile.currentStreak = draft.currentStreak ?? profile.currentStreak;
          profile.longestStreak = draft.longestStreak ?? profile.longestStreak;
          profile.avatarId = draft.avatarId ?? profile.avatarId;
          profile.unlockedAvatarIds =
            draft.unlockedAvatarIds ?? [...profile.unlockedAvatarIds];
          profile.avatarFinalized =
            draft.avatarFinalized ?? profile.avatarFinalized;

          return {
            ...projectProfile(profile),
            activeProfileId: DEFAULT_PROFILE_KEY,
            profiles: { [DEFAULT_PROFILE_KEY]: profile },
          } as unknown as StatsState;
        }

        return persistedState as StatsState;
      },
    }
  )
);
