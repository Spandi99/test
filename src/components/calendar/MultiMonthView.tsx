import { useCallback, useEffect, useRef, useState } from "react";

import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from "@fullcalendar/core";
import type { DateSelectArg } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import multiMonthPlugin from "@fullcalendar/multimonth";
import FullCalendar from "@fullcalendar/react";

import { TaskModal } from "@/components/tasks/TaskModal";

import { useEventModalStore } from "@/lib/commands/groups/calendar";

import { useCalendarStore } from "@/store/calendar";
import { useSettingsStore } from "@/store/settings";
import { useTaskStore } from "@/store/task";

import { CalendarEvent, ExtendedEventProps } from "@/types/calendar";
import { Task, TaskStatus } from "@/types/task";

import { CalendarEventContent } from "./CalendarEventContent";
import { EventModal } from "./EventModal";
import { EventQuickView } from "./EventQuickView";
import { buildCalendarDisplayEvents } from "./utils/format-events";
import type { CalendarDisplayEvent } from "./utils/format-events";

interface MultiMonthViewProps {
  currentDate: Date;
  onDateClick?: (date: Date) => void;
}

export function MultiMonthView({
  currentDate,
  onDateClick,
}: MultiMonthViewProps) {
  const { feeds, getAllCalendarItems, isLoading, removeEvent } =
    useCalendarStore();
  const { user: userSettings } = useSettingsStore();
  const { updateTask } = useTaskStore();
  const [selectedEvent, setSelectedEvent] = useState<Partial<CalendarEvent>>();
  const [selectedTask, setSelectedTask] = useState<Task>();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedEndDate, setSelectedEndDate] = useState<Date>();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [events, setEvents] = useState<CalendarDisplayEvent[]>([]);
  const calendarRef = useRef<FullCalendar>(null);
  const tasks = useTaskStore((state) => state.tasks);
  const [quickViewItem, setQuickViewItem] = useState<CalendarEvent | Task>();
  const [isTask, setIsTask] = useState(false);
  const eventModalStore = useEventModalStore();
  const [clickedElement, setClickedElement] = useState<HTMLElement | null>(null);

  // Update events when the calendar view changes
  const handleDatesSet = useCallback(
    async (arg: DatesSetArg) => {
      const items = getAllCalendarItems(arg.start, arg.end);
      const enabledItems = items.filter((item) => {
        if (item.feedId === "tasks") return true;
        const feed = feeds.find((f) => f.id === item.feedId);
        return feed?.enabled;
      });

      const formattedItems = buildCalendarDisplayEvents(enabledItems);
      setEvents(formattedItems);
    },
    [feeds, getAllCalendarItems]
  );

  // Initial data load
  useEffect(() => {
    Promise.all([
      useCalendarStore.getState().loadFromDatabase(),
      useTaskStore.getState().fetchTasks(),
    ]);
  }, []);

  // Update items when loading state changes, feeds change, or tasks change
  useEffect(() => {
    if (!isLoading && calendarRef.current) {
      const calendar = calendarRef.current.getApi();
      handleDatesSet({
        start: calendar.view.activeStart,
        end: calendar.view.activeEnd,
        startStr: calendar.view.activeStart.toISOString(),
        endStr: calendar.view.activeEnd.toISOString(),
        timeZone: userSettings.timeZone,
        view: calendar.view,
      });
    }
  }, [isLoading, feeds, userSettings.timeZone, handleDatesSet, tasks]);

  // Update calendar date when currentDate changes
  useEffect(() => {
    if (calendarRef.current) {
      setTimeout(() => {
        if (calendarRef.current) {
          const calendar = calendarRef.current.getApi();
          calendar.gotoDate(currentDate);
        }
      }, 0);
    }
  }, [currentDate]);

  const handleEventClick = (info: EventClickArg) => {
    const item = info.event.extendedProps as ExtendedEventProps & {
      sourceEventId?: string;
      isTask?: boolean;
    };
    const itemId = info.event.id;
    const isTask = item.isTask;
    const sourceEventId = item.sourceEventId || itemId;

    // Store the clicked element for positioning
    setClickedElement(info.el);

    if (isTask) {
      const task = useTaskStore.getState().tasks.find((t) => t.id === itemId);
      if (task) {
        setQuickViewItem(task);
        setIsTask(true);
      }
    } else {
      const event =
        useCalendarStore.getState().events.find((e) => e.id === sourceEventId) ??
        useCalendarStore
          .getState()
          .events.find((e) => e.id === itemId);
      setQuickViewItem(event as CalendarEvent);
      setIsTask(false);
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const start = selectInfo.start;
    const end = selectInfo.allDay ? start : selectInfo.end;

    setSelectedDate(start);
    setSelectedEndDate(end);
    setSelectedEvent({
      allDay: selectInfo.allDay,
    });
    setIsEventModalOpen(true);
  };

  const handleEventModalClose = () => {
    setIsEventModalOpen(false);
    eventModalStore.setOpen(false);
    setSelectedEvent(undefined);
    setSelectedDate(undefined);
    setSelectedEndDate(undefined);
    eventModalStore.setDefaultDate(undefined);
    eventModalStore.setDefaultEndDate(undefined);
  };

  const handleTaskModalClose = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(undefined);
  };

  const handleQuickViewClose = () => {
    setQuickViewItem(undefined);
    setClickedElement(null);
  };

  const handleQuickViewEdit = () => {
    if (!quickViewItem) return;

    if (isTask) {
      setSelectedTask(quickViewItem as Task);
      setIsTaskModalOpen(true);
    } else {
      setSelectedEvent(quickViewItem as CalendarEvent);
      setIsEventModalOpen(true);
    }
    handleQuickViewClose();
  };

  const handleQuickViewDelete = async () => {
    if (!quickViewItem) return;

    if (isTask) {
      if (confirm("Are you sure you want to delete this task?")) {
        await useTaskStore.getState().deleteTask(quickViewItem.id);
        handleQuickViewClose();
      }
    } else {
      if (confirm("Are you sure you want to delete this event?")) {
        await removeEvent(
          quickViewItem.id,
          quickViewItem.isRecurring ? "series" : "single"
        );
        handleQuickViewClose();
      }
    }
  };

  const handleQuickViewStatusChange = async (
    taskId: string,
    status: TaskStatus
  ) => {
    if (!quickViewItem) return;

    await updateTask(taskId, { status });

    // Update the quick view item to reflect the new status
    if (isTask) {
      const updatedTask = useTaskStore
        .getState()
        .tasks.find((t) => t.id === taskId);
      if (updatedTask) {
        setQuickViewItem(updatedTask);
      }
    }
  };

  const handleEventDrop = async (info: EventDropArg) => {
    const item = info.event.extendedProps as ExtendedEventProps & {
      sourceEventId?: string;
      isTask?: boolean;
    };

    if (item.isTask) {
      info.revert();
      return;
    }

    const sourceEventId = item.sourceEventId || info.event.id;
    const startDate = info.event.start
      ? new Date(info.event.start.getTime())
      : null;
    const endDate = info.event.end
      ? new Date(info.event.end.getTime())
      : startDate;

    if (!startDate || !endDate) {
      info.revert();
      return;
    }

    try {
      await useCalendarStore
        .getState()
        .updateEvent(sourceEventId, { start: startDate, end: endDate }, "single");
      await useCalendarStore.getState().refreshEvents();
    } catch (error) {
      console.error("Failed to move event", error);
      info.revert();
    }
  };

  const renderEventContent = useCallback(
    (arg: EventContentArg) => <CalendarEventContent eventInfo={arg} />,
    []
  );

  return (
    <div className="h-full">
      <FullCalendar
        ref={calendarRef}
        plugins={[multiMonthPlugin, interactionPlugin]}
        initialView="multiMonthYear"
        headerToolbar={false}
        initialDate={currentDate}
        events={events}
        dayMaxEvents={true}
        multiMonthMaxColumns={3}
        expandRows={true}
        stickyHeaderDates={true}
        timeZone="local"
        displayEventEnd={true}
        firstDay={userSettings.weekStartDay === "monday" ? 1 : 0}
        height="100%"
        dateClick={(arg) => onDateClick?.(arg.date)}
        eventClick={handleEventClick}
        select={handleDateSelect}
        selectable={true}
        selectMirror={true}
        editable
        eventStartEditable
        eventDurationEditable
        eventDrop={handleEventDrop}
        datesSet={handleDatesSet}
        eventContent={renderEventContent}
      />

      <EventModal
        isOpen={isEventModalOpen || eventModalStore.isOpen}
        onClose={handleEventModalClose}
        event={selectedEvent}
        defaultDate={selectedDate || eventModalStore.defaultDate}
        defaultEndDate={selectedEndDate || eventModalStore.defaultEndDate}
      />

      {selectedTask && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={handleTaskModalClose}
          task={selectedTask}
          tags={useTaskStore.getState().tags}
          onSave={async (updates) => {
            await useTaskStore.getState().updateTask(selectedTask.id, updates);
            handleTaskModalClose();
          }}
          onCreateTag={async (name: string, color?: string) => {
            return useTaskStore.getState().createTag({ name, color });
          }}
        />
      )}

      {quickViewItem && (
        <EventQuickView
          isOpen={!!quickViewItem}
          onClose={handleQuickViewClose}
          item={quickViewItem}
          onEdit={handleQuickViewEdit}
          onDelete={handleQuickViewDelete}
          onStatusChange={handleQuickViewStatusChange}
          referenceElement={clickedElement}
          isTask={isTask}
        />
      )}
    </div>
  );
}
