"use client";

import { useEffect, useMemo, useState } from "react";

import { HiCheck, HiPencil, HiTrash, HiX } from "react-icons/hi";
import { toast } from "sonner";
import {
  IoCalendarOutline,
  IoFlagOutline,
  IoFolderOutline,
  IoLocationOutline,
  IoLockClosedOutline,
  IoPeopleOutline,
  IoRepeat,
  IoTimeOutline,
} from "react-icons/io5";

import {
  addDays,
  addHours,
  format,
  formatToLocalISOString,
  isFutureDate,
  newDate,
} from "@/lib/date-utils";
import { mapEventToSample } from "@/lib/productivity";
import { isTaskOverdue } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { showXpToast } from "@/components/stats/showXpToast";

import { AttendeeStatus, CalendarEvent } from "@/types/calendar";
import { Priority, Task, TaskStatus } from "@/types/task";
import { useCalendarStore } from "@/store/calendar";
import { getEventRewardKey, useStatsStore } from "@/store/stats";

interface Attendee {
  name?: string;
  email: string;
  status?: AttendeeStatus;
}

interface EventQuickViewProps {
  isOpen: boolean;
  onClose: () => void;
  item:
  | (CalendarEvent & {
    attendees?: Attendee[];
    extendedProps?: { isTask?: boolean };
  })
  | (Task & { project?: { name: string; color?: string | null } | null });
  onEdit: () => void;
  onDelete: () => void;
  isTask: boolean;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  referenceElement: HTMLElement | null;
}

//TODO: move to utils
const priorityColors = {
  [Priority.HIGH]: "text-destructive dark:text-destructive",
  [Priority.MEDIUM]: "text-warning dark:text-warning",
  [Priority.LOW]: "text-primary dark:text-primary",
  [Priority.NONE]: "text-muted-foreground",
};

const FLAG_LABELS: Record<string, string> = {
  flexible: "Flexibel",
  fixed: "Fix",
  "conditional-learning": "Lernblock",
  dopamine: "Dopamin Boost",
};

type RescheduleOption = "none" | "1h" | "3h" | "1d" | "custom";

const RESCHEDULE_CHOICES: Array<{ value: RescheduleOption; label: string }> = [
  { value: "none", label: "Nicht verschieben" },
  { value: "1h", label: "+1 Stunde" },
  { value: "3h", label: "+3 Stunden" },
  { value: "1d", label: "Morgen" },
  { value: "custom", label: "Datum wählen" },
];

export function EventQuickView({
  isOpen,
  onClose,
  item,
  onEdit,
  onDelete,
  isTask,
  onStatusChange,
  referenceElement,
}: EventQuickViewProps) {
  const awardEventCompletion = useStatsStore(
    (state) => state.awardEventCompletion
  );
  const recordEventMissed = useStatsStore((state) => state.recordEventMissed);
  const awardedEventIds = useStatsStore((state) => state.awardedEventIds);
  const updateEvent = useCalendarStore((state) => state.updateEvent);
  const getStatusColor = (status: string | undefined) => {
    switch (status?.toUpperCase()) {
      case "ACCEPTED":
      case TaskStatus.COMPLETED:
        return "text-green-600 dark:text-green-400";
      case "TENTATIVE":
      case TaskStatus.IN_PROGRESS:
        return "text-warning dark:text-warning";
      case "DECLINED":
        return "text-destructive dark:text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  // Cast item to the appropriate type based on isTask
  const taskItem = isTask ? (item as Task) : null;
  const eventItem = !isTask
    ? (item as CalendarEvent & { attendees?: Attendee[] })
    : null;

  const isOverdue = taskItem && isTaskOverdue(taskItem);
  const isPreparationReminder = Boolean(
    !isTask && eventItem?.extendedProps?.isPreparationReminder
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [rescheduleOption, setRescheduleOption] = useState<RescheduleOption>(
    "none"
  );
  const [customReschedule, setCustomReschedule] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    setFeedbackOpen(false);
    setFeedbackText("");
    setRescheduleOption("none");
    setCustomReschedule("");
    setIsSubmittingFeedback(false);
  }, [item]);

  useEffect(() => {
    if (!feedbackOpen) {
      setFeedbackText("");
      setRescheduleOption("none");
      setCustomReschedule("");
      setIsSubmittingFeedback(false);
    }
  }, [feedbackOpen]);

  const eventRewardKey = useMemo(() => {
    if (!eventItem) return undefined;
    return getEventRewardKey(eventItem);
  }, [eventItem]);

  const hasClaimedReward = Boolean(
    eventRewardKey && awardedEventIds[eventRewardKey]
  );

  const eventDurationMinutes = useMemo(() => {
    if (!eventItem) return 60;
    const startDate = newDate(eventItem.start);
    const endDate = eventItem.end
      ? newDate(eventItem.end)
      : eventItem.allDay
        ? addHours(startDate, 24)
        : addHours(startDate, 1);
    let duration = Math.round(
      Math.abs(endDate.getTime() - startDate.getTime()) / 60000
    );
    if (!Number.isFinite(duration) || duration <= 0) {
      duration = eventItem.allDay ? 1440 : 60;
    }
    return Math.max(30, duration);
  }, [eventItem]);

  const handleRescheduleSelection = (option: RescheduleOption) => {
    setRescheduleOption(option);
    if (option === "custom" && eventItem) {
      setCustomReschedule(formatToLocalISOString(newDate(eventItem.start)));
    }
  };

  const handleSubmitFeedback = async () => {
    if (!eventItem) return;
    setIsSubmittingFeedback(true);
    try {
      let rescheduledStart: Date | null = null;
      if (rescheduleOption === "1h") {
        rescheduledStart = addHours(newDate(eventItem.start), 1);
      } else if (rescheduleOption === "3h") {
        rescheduledStart = addHours(newDate(eventItem.start), 3);
      } else if (rescheduleOption === "1d") {
        rescheduledStart = addDays(newDate(eventItem.start), 1);
      } else if (rescheduleOption === "custom") {
        if (!customReschedule) {
          toast.error("Bitte wähle einen neuen Zeitpunkt.");
          setIsSubmittingFeedback(false);
          return;
        }
        rescheduledStart = newDate(customReschedule);
      }

      let rescheduledEnd: Date | null = null;
      if (rescheduledStart) {
        const duration = eventDurationMinutes;
        rescheduledEnd = new Date(
          rescheduledStart.getTime() + duration * 60000
        );
        const sourceEventId =
          eventItem.extendedProps?.sourceEventId ?? eventItem.id;
        const updates: Partial<CalendarEvent> = {
          start: rescheduledStart,
          end: rescheduledEnd,
        };
        if (eventItem.allDay) {
          updates.allDay = true;
        }
        await updateEvent(sourceEventId, updates, "single");
      }

      recordEventMissed(
        eventItem,
        feedbackText,
        rescheduledStart
      );

      toast.success("Feedback gespeichert", {
        description: rescheduledStart
          ? `Termin verschoben auf ${format(
              rescheduledStart,
              eventItem.allDay ? "PP" : "PPp"
            )}.`
          : "Danke für dein Feedback!",
      });
      setFeedbackOpen(false);
    } catch (error) {
      console.error("Failed to record event feedback", error);
      toast.error("Feedback konnte nicht gespeichert werden", {
        description: "Bitte versuche es erneut.",
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <>
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Termin nicht geschafft?</DialogTitle>
            <DialogDescription>
              Teile kurz dein Feedback und plane bei Bedarf sofort einen neuen
              Zeitpunkt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-feedback">Feedback</Label>
              <Textarea
                id="event-feedback"
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
                placeholder="Was hat dich aufgehalten?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Neu planen</Label>
              <div className="flex flex-wrap gap-2">
                {RESCHEDULE_CHOICES.map((choice) => (
                  <Button
                    key={choice.value}
                    type="button"
                    variant={
                      rescheduleOption === choice.value ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handleRescheduleSelection(choice.value)}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
              {rescheduleOption === "custom" && (
                <Input
                  type="datetime-local"
                  value={customReschedule}
                  onChange={(event) => setCustomReschedule(event.target.value)}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFeedbackOpen(false)}
              disabled={isSubmittingFeedback}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={handleSubmitFeedback}
              disabled={
                isSubmittingFeedback ||
                (rescheduleOption === "custom" && !customReschedule)
              }
            >
              {isSubmittingFeedback ? "Speichern..." : "Feedback senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <PopoverTrigger asChild>
          <div
            className="w-0 h-0 opacity-0 pointer-events-none"
            style={{
              position: "fixed",
              left: referenceElement
                ? referenceElement.getBoundingClientRect().left
                : 0,
              top: referenceElement
                ? referenceElement.getBoundingClientRect().top
                : 0,
            }}
          />
        </PopoverTrigger>
        <PopoverContent
          className="z-[10000] w-80 rounded-lg border border-border bg-background p-4 shadow-lg"
          align="start"
          sideOffset={24}
          onOpenAutoFocus={(e) => e.preventDefault()}
          forceMount
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="event-title flex items-center gap-2 font-medium text-foreground">
                {item.title}
                {isTask ? (
                <>
                  {taskItem?.isRecurring && (
                    <IoRepeat
                      className="h-4 w-4 text-primary"
                      title="Recurring task"
                    />
                  )}
                  {taskItem?.scheduleLocked && (
                    <IoLockClosedOutline
                      className="h-4 w-4 text-warning"
                      title="Schedule locked"
                    />
                  )}
                </>
              ) : (
                eventItem?.isRecurring && (
                  <IoRepeat
                    className="h-4 w-4 text-primary"
                    title="Recurring event"
                  />
                )
              )}
            </h3>
            <div className="flex items-center gap-1">
              {isTask && taskItem && onStatusChange && (
                <button
                  onClick={() =>
                    onStatusChange(
                      taskItem.id,
                      taskItem.status === TaskStatus.COMPLETED
                        ? TaskStatus.TODO
                        : TaskStatus.COMPLETED
                    )
                  }
                  className={cn(
                    "rounded-md p-1.5",
                    taskItem.status === TaskStatus.COMPLETED
                      ? "bg-green-500/20 text-green-700 hover:bg-green-500/30 dark:text-green-400"
                      : "text-muted-foreground hover:bg-muted hover:text-green-600"
                  )}
                  title={
                    taskItem.status === TaskStatus.COMPLETED
                      ? "Mark as todo"
                      : "Mark as completed"
                  }
                >
                  <HiCheck className="h-4 w-4" />
                </button>
              )}
              {!isTask && eventItem && !isPreparationReminder && (
                <>
                  <button
                    onClick={() => {
                      const summary = awardEventCompletion(eventItem);
                      if (!summary) {
                        toast.info("Belohnung bereits eingesammelt.");
                        return;
                      }
                      showXpToast(summary);
                      mapEventToSample(eventItem);
                    }}
                    className={cn(
                      "rounded-md p-1.5",
                      hasClaimedReward
                        ? "cursor-not-allowed bg-muted text-muted-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-green-600"
                    )}
                    title={
                      hasClaimedReward
                        ? "Belohnung bereits eingesammelt"
                        : "Belohnung einsammeln"
                    }
                    disabled={hasClaimedReward}
                  >
                    <HiCheck className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setRescheduleOption("none");
                      setCustomReschedule("");
                      setFeedbackOpen(true);
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Feedback geben"
                  >
                    <HiX className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                onClick={onEdit}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                title="Edit"
              >
                <HiPencil className="h-4 w-4" />
              </button>
              <button
                onClick={onDelete}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                title="Delete"
              >
                <HiTrash className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isTask && eventItem && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <IoTimeOutline className="h-4 w-4 flex-shrink-0" />
                <span>
                  {format(newDate(eventItem.start), "PPp")} -{" "}
                  {format(
                    newDate(eventItem.end),
                    eventItem.allDay ? "PP" : "p"
                  )}
                </span>
              </div>
              {eventItem.location && (
                <div className="flex items-center gap-2">
                  <IoLocationOutline className="h-4 w-4 flex-shrink-0" />
                  <span className="event-location line-clamp-2">
                    {eventItem.location}
                  </span>
                </div>
              )}
              {eventItem.extendedProps?.tags &&
                eventItem.extendedProps.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {eventItem.extendedProps.tags.map((tag) => (
                      <span
                        key={tag.id ?? tag.name}
                        className="rounded-full border border-border/40 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        style={
                          tag.color
                            ? { borderColor: tag.color, color: tag.color }
                            : undefined
                        }
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              {Array.isArray(eventItem.metadata?.flags) &&
                eventItem.metadata?.flags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <IoFlagOutline className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div className="flex flex-wrap gap-2 text-xs">
                      {eventItem.metadata.flags.map((flag) => (
                        <span
                          key={flag}
                          className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground"
                        >
                          {FLAG_LABELS[flag] ?? flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              {eventItem.attendees && eventItem.attendees.length > 0 && (
                <div className="flex items-start gap-2">
                  <IoPeopleOutline className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="flex-1">
                    {eventItem.attendees.map((attendee) => (
                      <div
                        key={attendee.email}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="event-attendees flex-1 truncate">
                          {attendee.name || attendee.email}
                        </span>
                        <span
                          className={cn(
                            "ml-2 flex-shrink-0",
                            getStatusColor(attendee.status)
                          )}
                        >
                          {attendee.status?.toLowerCase() || "pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {eventItem.description && (
                <div className="event-description mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {eventItem.description}
                </div>
              )}
            </div>
          )}

          {isTask && taskItem && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IoTimeOutline className="h-4 w-4 flex-shrink-0" />
                  {taskItem.dueDate ? (
                    <span
                      className={cn(
                        isOverdue &&
                        "text-destructive dark:text-destructive font-medium",
                        isFutureDate(taskItem.dueDate) &&
                        "text-primary font-medium"
                      )}
                    >
                      Due {format(newDate(taskItem.dueDate), "PPp")}
                      {isOverdue && " (OVERDUE)"}
                      {isFutureDate(taskItem.dueDate) && " (UPCOMING)"}
                    </span>
                  ) : (
                    <span>No due date</span>
                  )}
                </div>
                <span
                  className={cn("rounded-full px-2 py-0.5 text-xs", {
                    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100":
                      taskItem.status === TaskStatus.COMPLETED,
                    "bg-warning/10 text-warning":
                      taskItem.status === TaskStatus.IN_PROGRESS,
                    "bg-muted text-muted-foreground":
                      taskItem.status === TaskStatus.TODO,
                  })}
                >
                  {taskItem.status.toLowerCase().replace("_", " ")}
                </span>
              </div>

              {taskItem.startDate && (
                <div className="flex items-center gap-2">
                  <IoCalendarOutline className="h-4 w-4 flex-shrink-0" />
                  <span
                    className={cn(
                      isFutureDate(taskItem.startDate) &&
                      "text-primary font-medium"
                    )}
                  >
                    Starts {format(newDate(taskItem.startDate), "PPp")}
                    {isFutureDate(taskItem.startDate) && " (UPCOMING)"}
                  </span>
                </div>
              )}

              {taskItem.priority && (
                <div className="flex items-center gap-2">
                  <IoFlagOutline className="h-4 w-4 flex-shrink-0" />
                  <span
                    className={cn(
                      "text-sm",
                      priorityColors[taskItem.priority]
                    )}
                  >
                    {taskItem.priority.charAt(0).toUpperCase() +
                      taskItem.priority.slice(1)}{" "}
                    Priority
                  </span>
                </div>
              )}

              {taskItem.isAutoScheduled &&
                taskItem.scheduledStart &&
                taskItem.scheduledEnd && (
                  <div className="flex items-center gap-2">
                    <IoCalendarOutline className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1">
                      <div>
                        Scheduled:{" "}
                        {format(newDate(taskItem.scheduledStart), "PPp")} -{" "}
                        {format(newDate(taskItem.scheduledEnd), "p")}
                      </div>
                      {taskItem.scheduleScore !== undefined && (
                        <div className="text-xs text-muted-foreground">
                          Confidence:{" "}
                          {Math.round((taskItem.scheduleScore ?? 0) * 100)}%
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {taskItem.project && (
                <div className="flex items-center gap-2">
                  <IoFolderOutline className="h-4 w-4 flex-shrink-0" />
                  <span
                    className="rounded px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor:
                        (taskItem.project.color || "hsl(var(--primary))") +
                        "20",
                      color: taskItem.project.color || "hsl(var(--primary))",
                    }}
                  >
                    {taskItem.project.name}
                  </span>
                </div>
              )}

              {taskItem.duration && (
                <div className="flex items-center gap-2">
                  <IoTimeOutline className="h-4 w-4 flex-shrink-0" />
                  <span>Duration: {taskItem.duration} minutes</span>
                </div>
              )}

              {taskItem.tags && taskItem.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {taskItem.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor:
                          (tag.color || "hsl(var(--primary))") + "20",
                        color: tag.color || "hsl(var(--primary))",
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {taskItem.description && (
                <div className="task-description mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {taskItem.description}
                </div>
              )}
            </div>
          )}
        </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
