"use client";

import { useEffect, useRef, useState } from "react";

import * as AlertDialog from "@radix-ui/react-alert-dialog";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { formatToLocalISOString, newDate } from "@/lib/date-utils";
import { PROGRESSION_TAGS, getProgressionTag } from "@/lib/progression-tags";
import { cn } from "@/lib/utils";

import { useCalendarStore, CalendarEventRequest } from "@/store/calendar";
import { useSettingsStore } from "@/store/settings";
import { useTaskStore } from "@/store/task";

import { CalendarEvent, EventFlag } from "@/types/calendar";
import { NewTag, Tag } from "@/types/task";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: Partial<CalendarEvent>;
  defaultDate?: Date;
  defaultEndDate?: Date;
}

// Google Calendar recurrence rules
const FREQUENCIES = {
  NONE: "NONE",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;

type Frequency = (typeof FREQUENCIES)[keyof typeof FREQUENCIES];

// RRule weekday codes
const WEEKDAYS = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
} as const;

const FLAG_OPTIONS: Array<{
  value: EventFlag;
  label: string;
  description: string;
}> = [
  {
    value: "flexible",
    label: "Flexibel",
    description: "Kann verschoben werden, wenn der Tag eng wird.",
  },
  {
    value: "fixed",
    label: "Fix",
    description: "Bleibt unverrückbar im Kalender.",
  },
  {
    value: "conditional-learning",
    label: "Lernblock",
    description: "Geplante Lernzeit, fällt aus wenn Uni-Events kollidieren.",
  },
  {
    value: "dopamine",
    label: "Dopamin-Boost",
    description: "Wird besonders gefeiert – perfekte Motivation.",
  },
];

// Helper function to parse recurrence rule
function parseRecurrenceRule(rule?: string) {
  if (!rule) return { freq: FREQUENCIES.NONE, interval: 1, byDay: [] };

  // Remove RRULE: prefix and any array wrapper
  rule = rule.replace(/^\[?"?RRULE:/i, "").replace(/"?\]?$/, "");

  const parts = rule.split(";");
  const result = {
    freq: FREQUENCIES.NONE as Frequency,
    interval: 1,
    byDay: [] as string[],
  };

  parts.forEach((part) => {
    const [key, value] = part.split("=");
    switch (key) {
      case "FREQ":
        result.freq = value as Frequency;
        break;
      case "INTERVAL":
        result.interval = parseInt(value, 10);
        break;
      case "BYDAY":
        result.byDay = value.split(",");
        break;
    }
  });

  return result;
}

// Helper function to build recurrence rule
function buildRecurrenceRule(freq: string, interval: number, byDay: string[]) {
  if (freq === FREQUENCIES.NONE) return "";

  const parts = [];

  // Add frequency
  if (Object.values(FREQUENCIES).includes(freq as Frequency)) {
    parts.push(`FREQ=${freq}`);
  }

  // Add interval if greater than 1
  if (interval > 1) {
    parts.push(`INTERVAL=${interval}`);
  }

  // Add BYDAY for weekly recurrence
  if (freq === FREQUENCIES.WEEKLY && byDay.length > 0) {
    // byDay should already be in RRule format (MO, TU, etc.)
    console.log("Building RRule with weekdays:", byDay);
    parts.push(`BYDAY=${byDay.join(",")}`);
  }

  const rule = parts.join(";");
  console.log("Built RRule:", rule);
  return rule;
}

export function EventModal({
  isOpen,
  onClose,
  event,
  defaultDate,
  defaultEndDate,
}: EventModalProps) {
  const { feeds, addEvent, updateEvent, removeEvent } = useCalendarStore();
  const { calendar } = useSettingsStore();
  const availableTags = useTaskStore((state) => state.tags);
  const fetchTags = useTaskStore((state) => state.fetchTags);
  const createTag = useTaskStore((state) => state.createTag);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false);
  const [editMode, setEditMode] = useState<"single" | "series">();
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [location, setLocation] = useState(event?.location || "");
  const [startDate, setStartDate] = useState<Date>(
    event?.start
      ? newDate(event.start)
      : defaultDate
        ? newDate(defaultDate)
        : newDate()
  );
  const [endDate, setEndDate] = useState<Date>(
    event?.end
      ? newDate(event.end)
      : defaultEndDate
        ? newDate(defaultEndDate)
        : newDate(Date.now() + 3600000)
  );
  const [selectedFeedId, setSelectedFeedId] = useState<string>(
    event?.feedId || calendar.defaultCalendarId || ""
  );
  const [isAllDay, setIsAllDay] = useState(event?.allDay || false);
  const [isRecurring, setIsRecurring] = useState(event?.isRecurring || false);
  const [recurrenceFreq, setRecurrenceFreq] = useState("");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceByDay, setRecurrenceByDay] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [progressionTagId, setProgressionTagId] = useState<string | undefined>();
  const [eventFlags, setEventFlags] = useState<EventFlag[]>([]);
  const [energyLevel, setEnergyLevel] = useState<string>("");

  useEffect(() => {
    if (isOpen && availableTags.length === 0) {
      fetchTags().catch(() => undefined);
    }
  }, [isOpen, availableTags.length, fetchTags]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(event?.title || "");
      setDescription(event?.description || "");
      setLocation(event?.location || "");
      setStartDate(
        event?.start
          ? newDate(event.start)
          : defaultDate
            ? newDate(defaultDate)
            : newDate()
      );
      setEndDate(
        event?.end
          ? newDate(event.end)
          : defaultEndDate
            ? newDate(defaultEndDate)
            : newDate(Date.now() + 3600000)
      );
      setSelectedFeedId(event?.feedId || calendar.defaultCalendarId || "");
      setIsAllDay(event?.allDay || false);
      setIsRecurring(event?.isRecurring || false);
      const { freq, interval, byDay } = parseRecurrenceRule(
        event?.recurrenceRule
      );
      setRecurrenceFreq(freq || "");
      setRecurrenceInterval(interval);
      setRecurrenceByDay(byDay);
      setEditMode(undefined);
      setShowRecurrenceDialog(false);

      const eventTags: Tag[] = Array.isArray(event?.metadata?.tags)
        ? (event?.metadata?.tags as Tag[])
        : Array.isArray(event?.extendedProps?.tags)
          ? (event?.extendedProps?.tags as Tag[])
          : event?.tagIds && event.tagIds.length > 0
            ? availableTags.filter((tag) => event.tagIds?.includes(tag.id))
            : [];

      setSelectedTagIds(
        eventTags
          .map((tag) => tag.id)
          .filter((id): id is string => Boolean(id))
      );

      const metadata = (event?.metadata as Record<string, unknown> | null) ?? null;
      setProgressionTagId(
        (metadata?.progressionTagId as string | undefined) || undefined
      );
      setEventFlags(
        Array.isArray(metadata?.flags)
          ? (metadata?.flags.filter(Boolean) as EventFlag[])
          : event?.feed?.type === "CALDAV"
            ? ["fixed"]
            : []
      );
      setEnergyLevel(
        typeof metadata?.energyLevel === "number"
          ? String(metadata?.energyLevel)
          : ""
      );
      setNewTagName("");
      setNewTagColor("#3b82f6");

      // Focus the title input
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [
    isOpen,
    event,
    defaultDate,
    defaultEndDate,
    feeds,
    calendar.defaultCalendarId,
    availableTags,
  ]);

  // Show recurrence dialog when editing a recurring event
  useEffect(() => {
    if (isOpen && event?.isRecurring && !editMode && !showRecurrenceDialog) {
      //todo: we need to handle editing series vs single, for now forcing to always edit series
      // setShowRecurrenceDialog(true);
      setEditMode("series");
    }
  }, [isOpen, event?.isRecurring, editMode, showRecurrenceDialog]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCreateTag = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTagName.trim()) {
      return;
    }

    setIsCreatingTag(true);
    try {
      const created = await createTag({
        name: newTagName.trim(),
        color: newTagColor,
      } as NewTag);
      setSelectedTagIds((prev) =>
        prev.includes(created.id) ? prev : [...prev, created.id]
      );
      setNewTagName("");
    } catch (error) {
      console.error("Failed to create tag", error);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const selectedTags = selectedTagIds
    .map((id) => availableTags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => Boolean(tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const feed = feeds.find((f) => f.id === selectedFeedId);
      if (!feed) {
        console.error("Selected calendar not found");
        return;
      }

      const progressionTag = getProgressionTag(progressionTagId);
      const metadata = {
        tags: selectedTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color ?? null,
        })),
        progressionTagId,
        statKey: progressionTag?.statKey,
        taskType: progressionTag?.taskType,
        flags: eventFlags,
        energyLevel: energyLevel ? Number(energyLevel) : undefined,
        feedType: feed.type,
      };

      const eventData: CalendarEventRequest = {
        title,
        description,
        location,
        start: startDate,
        end: endDate,
        feedId: selectedFeedId,
        allDay: isAllDay,
        isRecurring,
        recurrenceRule: isRecurring
          ? buildRecurrenceRule(
              recurrenceFreq,
              recurrenceInterval,
              recurrenceByDay
            )
          : undefined,
        isMaster: false,
        tagIds: selectedTagIds,
        metadata,
      };

      if (event?.id) {
        // For existing events
        if (feed.type === "GOOGLE" && !event.externalEventId) {
          throw new Error("Cannot edit this Google Calendar event");
        }
        await updateEvent(event.id, eventData, editMode);
      } else {
        // For new events
        await addEvent(eventData);
      }
      // Reset all states before closing
      resetState();
      onClose();
    } catch (error) {
      console.error("Failed to save event:", error);
      alert(error instanceof Error ? error.message : "Failed to save event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;

    try {
      setIsSubmitting(true);
      await removeEvent(event.id, editMode);
      resetState();
      onClose();
    } catch (error) {
      console.error("Failed to delete event:", error);
      alert(error instanceof Error ? error.message : "Failed to delete event");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to render recurrence options
  const renderRecurrenceOptions = () => {
    if (!isRecurring) return null;

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recurrence-freq">Repeats</Label>
          <Select
            value={recurrenceFreq || FREQUENCIES.WEEKLY}
            onValueChange={(value) =>
              setRecurrenceFreq(value === FREQUENCIES.NONE ? "" : value)
            }
          >
            <SelectTrigger id="recurrence-freq" data-testid="recurrence-freq">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FREQUENCIES.DAILY}>Daily</SelectItem>
              <SelectItem value={FREQUENCIES.WEEKLY}>Weekly</SelectItem>
              <SelectItem value={FREQUENCIES.MONTHLY}>Monthly</SelectItem>
              <SelectItem value={FREQUENCIES.YEARLY}>Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {recurrenceFreq && recurrenceFreq !== FREQUENCIES.NONE && (
          <>
            <div className="space-y-2">
              <Label htmlFor="recurrence-interval">Repeat every</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="recurrence-interval"
                  min="1"
                  value={recurrenceInterval}
                  onChange={(e) =>
                    setRecurrenceInterval(
                      Math.max(1, parseInt(e.target.value, 10))
                    )
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  {recurrenceFreq.toLowerCase()}
                  {recurrenceInterval > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {recurrenceFreq === FREQUENCIES.WEEKLY && (
              <div className="space-y-2">
                <Label>Repeat on</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(WEEKDAYS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <Checkbox
                        checked={recurrenceByDay.includes(key)}
                        onCheckedChange={(checked) => {
                          setRecurrenceByDay(
                            checked
                              ? [...recurrenceByDay, key]
                              : recurrenceByDay.filter((d) => d !== key)
                          );
                        }}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[90vh] max-w-[500px] flex-col p-0">
          {isSubmitting && <LoadingOverlay />}
          <DialogHeader className="space-y-1.5 px-6 pb-4 pt-6">
            <DialogTitle>{event?.id ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 overflow-y-auto px-6 pb-6"
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                type="text"
                id="title"
                ref={titleInputRef}
                data-testid="event-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="event-title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar">Calendar</Label>
              <Select
                value={selectedFeedId}
                onValueChange={(value) => setSelectedFeedId(value)}
                disabled={!!event?.id}
              >
                <SelectTrigger id="calendar" data-testid="calendar-select">
                  <SelectValue placeholder="Select a calendar" />
                </SelectTrigger>
                <SelectContent>
                  {feeds
                    .filter((feed) => feed.enabled)
                    .map((feed) => (
                      <SelectItem key={feed.id} value={feed.id}>
                        {feed.name} {feed.type === "GOOGLE" ? "(Google)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start</Label>
                <Input
                  type={isAllDay ? "date" : "datetime-local"}
                  id="start"
                  data-testid="event-start-date"
                  value={
                    isAllDay
                      ? formatToLocalISOString(startDate).split("T")[0]
                      : formatToLocalISOString(startDate)
                  }
                  onChange={(e) => setStartDate(newDate(e.target.value))}
                  className={cn(
                    "cursor-pointer px-3 py-2",
                    "[&::-webkit-calendar-picker-indicator]:ml-auto",
                    "[&::-webkit-calendar-picker-indicator]:mr-1",
                    "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                    "[&::-webkit-calendar-picker-indicator]:rounded-md",
                    "[&::-webkit-calendar-picker-indicator]:hover:bg-accent",
                    "[&::-webkit-calendar-picker-indicator]:dark:invert",
                    "[&::-webkit-datetime-edit]:text-foreground",
                    "[&::-webkit-datetime-edit-fields-wrapper]:p-0"
                  )}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end">End</Label>
                <Input
                  type={isAllDay ? "date" : "datetime-local"}
                  id="end"
                  data-testid="event-end-date"
                  value={
                    isAllDay
                      ? formatToLocalISOString(endDate).split("T")[0]
                      : formatToLocalISOString(endDate)
                  }
                  onChange={(e) => setEndDate(newDate(e.target.value))}
                  className={cn(
                    "cursor-pointer px-3 py-2",
                    "[&::-webkit-calendar-picker-indicator]:ml-auto",
                    "[&::-webkit-calendar-picker-indicator]:mr-1",
                    "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                    "[&::-webkit-calendar-picker-indicator]:rounded-md",
                    "[&::-webkit-calendar-picker-indicator]:hover:bg-accent",
                    "[&::-webkit-calendar-picker-indicator]:dark:invert",
                    "[&::-webkit-datetime-edit]:text-foreground",
                    "[&::-webkit-datetime-edit-fields-wrapper]:p-0"
                  )}
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="all-day"
                checked={isAllDay}
                onCheckedChange={(checked) => setIsAllDay(checked as boolean)}
              />
              <Label htmlFor="all-day" className="text-sm">
                All day
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="event-location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                data-testid="event-description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="event-description resize-none"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Tags</Label>
                {selectedTags.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Boost für {selectedTags.map((tag) => tag.name).join(", ")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableTags.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Noch keine Tags vorhanden – lege unten einen neuen an.
                  </span>
                ) : (
                  availableTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    const accent = tag.color || "#6366f1";
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold transition",
                          isSelected
                            ? "text-white shadow-sm"
                            : "border-border text-muted-foreground hover:border-primary/60"
                        )}
                        style={
                          isSelected
                            ? { backgroundColor: accent, borderColor: accent }
                            : tag.color
                              ? { borderColor: accent, color: accent }
                              : undefined
                        }
                      >
                        {tag.name}
                      </button>
                    );
                  })
                )}
              </div>
              <form
                onSubmit={handleCreateTag}
                className="flex flex-wrap items-center gap-2"
              >
                <Input
                  type="text"
                  placeholder="Neuen Tag hinzufügen"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-9 w-40"
                />
                <Input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-9 w-16 cursor-pointer p-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled={!newTagName.trim() || isCreatingTag}
                >
                  {isCreatingTag ? "Speichere…" : "Tag speichern"}
                </Button>
              </form>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-progression">Stat Kategorie</Label>
              <Select
                value={progressionTagId ?? "none"}
                onValueChange={(value) =>
                  setProgressionTagId(value === "none" ? undefined : value)
                }
              >
                <SelectTrigger id="event-progression">
                  <SelectValue placeholder="Kategorie auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Zuordnung</SelectItem>
                  {PROGRESSION_TAGS.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {progressionTagId && (
                <p className="text-xs text-muted-foreground">
                  {getProgressionTag(progressionTagId)?.description}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Flags</Label>
              <div className="space-y-2 rounded-md border border-border/60 p-3">
                {FLAG_OPTIONS.map((flag) => {
                  const active = eventFlags.includes(flag.value);
                  return (
                    <button
                      key={flag.value}
                      type="button"
                      onClick={() => {
                        setEventFlags((prev) =>
                          prev.includes(flag.value)
                            ? prev.filter((value) => value !== flag.value)
                            : [...prev, flag.value]
                        );
                      }}
                      className={cn(
                        "flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-transparent bg-muted/40 hover:bg-muted/70"
                      )}
                    >
                      <span className="font-medium">{flag.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {flag.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-energy">Energie-Level (1-5)</Label>
              <Select
                value={energyLevel || "none"}
                onValueChange={(value) =>
                  setEnergyLevel(value === "none" ? "" : value)
                }
              >
                <SelectTrigger id="event-energy">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Wert</SelectItem>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <SelectItem key={level} value={String(level)}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={(checked) => {
                  const isChecked = checked as boolean;
                  setIsRecurring(isChecked);
                  if (
                    isChecked &&
                    (recurrenceFreq === FREQUENCIES.NONE || !recurrenceFreq)
                  ) {
                    setRecurrenceFreq(FREQUENCIES.WEEKLY);
                    const weekdayNum = startDate.getDay();
                    const weekdays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
                    const weekday = weekdays[weekdayNum];
                    setRecurrenceByDay([weekday]);
                  }
                }}
                data-testid="recurring-event-checkbox"
              />
              <Label htmlFor="recurring" className="text-sm">
                Recurring event
              </Label>
            </div>

            {renderRecurrenceOptions()}

            <div className="flex items-center justify-between pt-4">
              {event?.id ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  data-testid="delete-event-button"
                >
                  Delete
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="save-event-button">
                  {event?.id ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recurring Event Edit Mode Dialog */}
      <AlertDialog.Root
        open={showRecurrenceDialog}
        onOpenChange={(open) => {
          setShowRecurrenceDialog(open);
          if (!open) onClose();
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[10001] bg-background/80 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[10002] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
            <AlertDialog.Title className="mb-4 text-lg font-semibold">
              Edit Recurring Event
            </AlertDialog.Title>
            <AlertDialog.Description className="mb-6 text-sm text-muted-foreground">
              Would you like to edit this event or the entire series?
            </AlertDialog.Description>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRecurrenceDialog(false);
                  onClose();
                }}
                data-testid="edit-cancel-button"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setEditMode("single");
                  setShowRecurrenceDialog(false);
                }}
                data-testid="edit-single-event-button"
              >
                This Event
              </Button>
              <Button
                onClick={() => {
                  setEditMode("series");
                  setShowRecurrenceDialog(false);
                }}
                data-testid="edit-series-button"
              >
                Entire Series
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );

  function resetState() {
    setShowRecurrenceDialog(false);
    setEditMode(undefined);
    setTitle("");
    setDescription("");
    setLocation("");
    setStartDate(newDate());
    setEndDate(newDate(Date.now() + 3600000));
    setIsAllDay(false);
    setIsRecurring(false);
    setRecurrenceFreq("");
    setRecurrenceInterval(1);
    setRecurrenceByDay([]);
    setSelectedTagIds([]);
    setNewTagName("");
    setNewTagColor("#3b82f6");
    setIsCreatingTag(false);
    setProgressionTagId(undefined);
    setEventFlags([]);
    setEnergyLevel("");
  }
}
