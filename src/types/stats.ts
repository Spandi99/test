export type StatKey = "focus" | "endurance" | "creativity" | "social" | "wellbeing";

export interface StatSnapshot {
  key: StatKey;
  value: number;
}

export interface StatChange {
  key: StatKey;
  amount: number;
  newValue: number;
}

export interface GainSummary {
  source: "task" | "daily" | "manual";
  label: string;
  xpAwarded: number;
  previousLevel: number;
  newLevel: number;
  previousXp: number;
  newXp: number;
  xpForNextLevel: number;
  leveledUp: boolean;
  statChanges: StatChange[];
  timestamp: string;
}

export interface StatsEvent extends GainSummary {
  id: string;
}

export interface DailyActivityDefinition {
  id: string;
  label: string;
  description: string;
  statKey: StatKey;
  amount: number;
  xpReward: number;
  emoji: string;
}

export type WeekdayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
