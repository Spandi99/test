export type ProductivitySourceType = "task" | "event";

export interface ProductivitySampleInput {
  sourceType: ProductivitySourceType;
  sourceId: string;
  recordedAt: Date;
  start: Date;
  end: Date;
  durationMinutes: number;
  taskType: string;
  statKey: string;
  energyLevel?: number | null;
  overlapWithUni?: boolean;
  success: boolean;
  mood?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ProductivitySampleRecord extends ProductivitySampleInput {
  id: string;
  dayOfWeek: number;
  hourOfDay: number;
}
