"use client";

import { useEffect } from "react";

import dynamic from "next/dynamic";
import { HiMenu } from "react-icons/hi";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";

import { DayView } from "@/components/calendar/DayView";
import { FeedManager } from "@/components/calendar/FeedManager";
import { MonthView } from "@/components/calendar/MonthView";
import { MultiMonthView } from "@/components/calendar/MultiMonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { SponsorshipBanner } from "@/components/ui/sponsorship-banner";

import { addDays, formatDate, newDate, subDays } from "@/lib/date-utils";
import { isSaasEnabled } from "@/lib/config";
import { cn } from "@/lib/utils";

import {
  useCalendarStore,
  useCalendarUIStore,
  useViewStore,
} from "@/store/calendar";
import { useTaskStore } from "@/store/task";

import { CalendarEvent, CalendarFeed } from "@/types/calendar";

// Dynamically import the appropriate version of the LifetimeAccessBanner
const LifetimeAccessBanner = dynamic(
  () => import(`./LifetimeAccessBanner.${isSaasEnabled ? "saas" : "open"}`).then(
    (mod) => mod.LifetimeAccessBanner
  ),
  { ssr: false } // Disable SSR for this component to prevent import errors
);

interface CalendarProps {
  initialFeeds?: CalendarFeed[];
  initialEvents?: CalendarEvent[];
}

export function Calendar({
  initialFeeds = [],
  initialEvents = [],
}: CalendarProps) {
  const { date: currentDate, setDate, view, setView } = useViewStore();
  const { isSidebarOpen, setSidebarOpen, isHydrated } = useCalendarUIStore();
  const { scheduleAllTasks } = useTaskStore();
  const { setFeeds, setEvents } = useCalendarStore();

  // Use initial data from server for hydration
  useEffect(() => {
    if (initialFeeds.length > 0) {
      setFeeds(initialFeeds);
    }

    if (initialEvents.length > 0) {
      setEvents(initialEvents);
    }

    // Only fetch from database if we didn't get initial data
    if (!initialFeeds.length || !initialEvents.length) {
      useCalendarStore.getState().loadFromDatabase();
    }

    // Always fetch tasks since they're not pre-loaded
    useTaskStore.getState().fetchTasks();
  }, [initialFeeds, initialEvents, setFeeds, setEvents]);

  const handlePrevWeek = () => {
    if (view === "month" || view === "multiMonth") {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setDate(newDate);
    } else {
      const days = view === "day" ? 1 : 7;
      setDate(subDays(currentDate, days));
    }
  };

  const handleNextWeek = () => {
    if (view === "month" || view === "multiMonth") {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setDate(newDate);
    } else {
      const days = view === "day" ? 1 : 7;
      setDate(addDays(currentDate, days));
    }
  };

  const handleAutoSchedule = async () => {
    await scheduleAllTasks();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.innerWidth < 640) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  return (
    <div className="relative flex h-full w-full">
      {isSidebarOpen && (
        <div
          role="presentation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm sm:hidden"
        />
      )}
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-full max-w-sm flex-none border-r border-border bg-background",
          "shadow-lg transition-transform duration-300 ease-in-out sm:relative sm:max-w-none sm:shadow-none",
          "sm:w-80",
          !isHydrated && "opacity-0 duration-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ marginLeft: isSidebarOpen ? undefined : "-20rem" }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:hidden">
            <h2 className="text-sm font-medium text-foreground">Kalender</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
            >
              Zurück
            </button>
          </div>
          {/* Feed Manager */}
          <div className="flex-1 overflow-y-auto">
            <FeedManager />
          </div>

          {/* Sponsorship Banner */}
          <SponsorshipBanner />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        {/* Lifetime Access Banner */}
        <LifetimeAccessBanner />
        {/* Header */}
        <header className="border-b border-border bg-background/60 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <button
                  onClick={() => setSidebarOpen(!isSidebarOpen)}
                  className="rounded-lg p-2 text-foreground hover:bg-muted"
                  title="Toggle Sidebar (b)"
                >
                  <HiMenu className="h-5 w-5" />
                </button>
                <div className="flex flex-col sm:hidden">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    Heute
                  </span>
                  <h1 className="text-lg font-semibold text-foreground">
                    {formatDate(currentDate)}
                  </h1>
                </div>
              </div>
              <div className="hidden sm:flex sm:flex-col sm:gap-1">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Aktueller Blick
                </span>
                <h1 className="text-2xl font-semibold text-foreground">
                  {formatDate(currentDate)}
                </h1>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:gap-4">
              <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
                <button
                  onClick={() => setDate(newDate())}
                  className="w-full rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted sm:w-auto"
                  title="Go to Today (t)"
                >
                  Heute
                </button>
                <button
                  onClick={handleAutoSchedule}
                  className="w-full rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 sm:w-auto"
                >
                  Auto-Planung
                </button>
                <div className="flex w-full items-center justify-between rounded-lg border border-border px-2 py-1 sm:w-auto sm:justify-end sm:border-none sm:px-0 sm:py-0">
                  <button
                    onClick={handlePrevWeek}
                    className="rounded-lg p-1.5 text-foreground hover:bg-muted"
                    data-testid="calendar-prev-week"
                    title="Previous"
                  >
                    <IoChevronBack className="h-5 w-5" />
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">
                    Zeitraum
                  </span>
                  <button
                    onClick={handleNextWeek}
                    className="rounded-lg p-1.5 text-foreground hover:bg-muted"
                    data-testid="calendar-next-week"
                    title="Next"
                  >
                    <IoChevronForward className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <button
                  onClick={() => setView("day")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    "w-full sm:w-auto",
                    view === "day"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Tag
                </button>
                <button
                  onClick={() => setView("week")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    "w-full sm:w-auto",
                    view === "week"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Woche
                </button>
                <button
                  onClick={() => setView("month")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    "w-full sm:w-auto",
                    view === "month"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Monat
                </button>
                <button
                  onClick={() => setView("multiMonth")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    "w-full sm:w-auto",
                    view === "multiMonth"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Quartal
                </button>
                <button
                  onClick={() => setView("agenda")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    "w-full sm:w-auto",
                    view === "agenda"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Agenda
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-hidden px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="h-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {view === "day" ? (
              <DayView currentDate={currentDate} onDateClick={setDate} />
            ) : view === "week" ? (
              <WeekView currentDate={currentDate} onDateClick={setDate} />
            ) : view === "month" ? (
              <MonthView currentDate={currentDate} onDateClick={setDate} />
            ) : (
              <MultiMonthView currentDate={currentDate} onDateClick={setDate} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
