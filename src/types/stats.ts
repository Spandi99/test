export type StatKey = "focus" | "endurance" | "creativity" | "social" | "wellbeing";

export interface AvatarLayer {
  id: string;
  label: string;
  background: string;
  skinTone: string;
  hairColor: string;
  outfitColor: string;
  accentColor: string;
}

export interface AvatarOption {
  id: string;
  label: string;
  description: string;
  layers: AvatarLayer;
}

export interface TagBonusDefinition {
  id: string;
  label: string;
  patterns: RegExp[];
  statKey: StatKey;
  statAmount: number;
  xpBonus: number;
  hypeText: string;
}

export interface StatSnapshot {
  key: StatKey;
  value: number;
}

export interface StatChange {
  key: StatKey;
  amount: number;
  newValue: number;
}

export type GainSource = "task" | "daily" | "manual" | "event";

export interface GainSummary {
  source: GainSource;
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
  hypeText?: string;
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
