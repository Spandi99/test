import { formatISO, getDay, getHours } from "date-fns";

import { getProgressionTag } from "@/lib/progression-tags";

import { CalendarEvent } from "@/types/calendar";
import { ProductivitySampleInput } from "@/types/productivity";
import { Task } from "@/types/task";

const ENERGY_TO_NUMERIC: Record<string, number> = {
  high: 5,
  medium: 3,
  low: 1,
};

async function sendProductivitySample(payload: ProductivitySampleInput) {
  const response = await fetch("/api/productivity/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      recordedAt: formatISO(payload.recordedAt),
      start: formatISO(payload.start),
      end: formatISO(payload.end),
    }),
  });

  if (!response.ok) {
    console.error("Failed to log productivity sample", await response.text());
  }
}

function buildBaseSample({
  sourceType,
  sourceId,
  start,
  end,
  taskType,
  statKey,
  energyLevel,
  overlapWithUni,
  success,
  mood,
  metadata,
}: Omit<
  ProductivitySampleInput,
  "durationMinutes" | "recordedAt"
> & { durationMinutes?: number }): ProductivitySampleInput {
  const durationMinutes = Math.max(
    15,
    Math.round(Math.abs(end.getTime() - start.getTime()) / 60000)
  );

  return {
    sourceType,
    sourceId,
    recordedAt: new Date(),
    start,
    end,
    durationMinutes,
    taskType,
    statKey,
    energyLevel,
    overlapWithUni,
    success,
    mood,
    metadata,
  };
}

export function mapTaskToSample(task: Task, mood?: number | null) {
  const metadata = (task.metadata as Record<string, unknown> | null) ?? undefined;
  const progressionTagId = metadata?.progressionTagId as string | undefined;
  const progressionTag = getProgressionTag(progressionTagId);
  const taskType = progressionTag?.taskType ?? "Task";
  const statKey = progressionTag?.statKey ?? "focus";
  const start = task.scheduledStart
    ? new Date(task.scheduledStart)
    : task.startDate
      ? new Date(task.startDate)
      : new Date();
  const end = task.scheduledEnd
    ? new Date(task.scheduledEnd)
    : task.dueDate
      ? new Date(task.dueDate)
      : new Date(start.getTime() + (task.duration ?? 30) * 60000);

  const sample = buildBaseSample({
    sourceType: "task",
    sourceId: task.id,
    start,
    end,
    taskType,
    statKey,
    energyLevel: task.energyLevel ? ENERGY_TO_NUMERIC[task.energyLevel] : undefined,
    overlapWithUni: progressionTagId === "uni",
    success: true,
    mood,
    metadata,
    durationMinutes: task.duration ?? undefined,
  });

  void sendProductivitySample(sample);
}

export function mapEventToSample(event: CalendarEvent, mood?: number | null) {
  const metadata = (event.metadata as Record<string, unknown> | null) ?? undefined;
  const progressionTagId = metadata?.progressionTagId as string | undefined;
  const progressionTag = getProgressionTag(progressionTagId);
  const taskType = progressionTag?.taskType ?? "Event";
  const statKey = progressionTag?.statKey ?? "focus";
  const energyLevel = metadata?.energyLevel as number | undefined;
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + 30 * 60000);

  const overlapWithUni =
    progressionTagId === "uni" ||
    metadata?.feedType === "CALDAV" ||
    metadata?.feedType === "ICAL";

  const sample = buildBaseSample({
    sourceType: "event",
    sourceId: event.id,
    start,
    end,
    taskType,
    statKey,
    energyLevel,
    overlapWithUni,
    success: true,
    mood,
    metadata,
  });

  void sendProductivitySample(sample);
}

export function deriveFeatureColumns(sample: ProductivitySampleInput) {
  return {
    dayOfWeek: getDay(sample.start),
    hourOfDay: getHours(sample.start),
    duration: sample.durationMinutes,
    taskType: sample.taskType,
    energyLevel: sample.energyLevel ?? null,
    overlapWithUni: sample.overlapWithUni ? 1 : 0,
    success: sample.success ? 1 : 0,
    mood: sample.mood ?? null,
  };
}
