export interface CalendarFeed {
  id: string;
  name: string;
  url?: string; // Make optional since local calendar won't have URL
  type: "GOOGLE" | "OUTLOOK" | "CALDAV" | "LOCAL";
  color?: string;
  enabled: boolean;
  lastSync?: Date;
  error?: string;
  caldavPath?: string;
  accountId?: string;
  syncToken?: string;
  userId?: string;
}

export interface CalendarEventTag {
  id?: string;
  name: string;
  color?: string | null;
}

export type EventFlag =
  | "fixed"
  | "flexible"
  | "conditional-learning"
  | "dopamine";

export interface ExtendedEventProps {
  isTask?: boolean;
  taskId?: string;
  status?: string;
  priority?: string;
  energyLevel?: string;
  preferredTime?: string;
  tags?: CalendarEventTag[];
  isPreparationReminder?: boolean;
  sourceEventId?: string;
}

export interface CalendarEventMetadata {
  tags?: CalendarEventTag[];
  progressionTagId?: string;
  statKey?: string;
  taskType?: string;
  flags?: EventFlag[];
  energyLevel?: number;
  completion?: {
    at: string;
    mood?: number | null;
  } | null;
  feedType?: string;
  [key: string]: unknown;
}

export interface CalendarEvent {
  id: string;
  feedId: string;
  externalEventId?: string;
  outlookEventId?: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  allDay: boolean;
  color?: string;
  // Additional fields for iCal support
  uid?: string; // Unique identifier from iCal
  sequence?: number; // Modification sequence
  status?: EventStatus; // Event status (confirmed, cancelled, etc.)
  created?: Date; // Creation timestamp
  lastModified?: Date; // Last modification timestamp
  organizer?: {
    name?: string;
    email?: string;
  };
  attendees?: Array<{
    name?: string;
    email: string;
    status?: AttendeeStatus;
  }>;
  // New fields for hybrid approach
  isMaster: boolean;
  masterEventId?: string;
  recurringEventId?: string;
  // Extended properties for custom data
  extendedProps?: ExtendedEventProps;
  metadata?: CalendarEventMetadata | null;
  tagIds?: string[];
  feed?: {
    id: string;
    name: string;
    color?: string | null;
    type?: string | null;
  };
}

export enum EventStatus {
  CONFIRMED = "CONFIRMED",
  TENTATIVE = "TENTATIVE",
  CANCELLED = "CANCELLED",
}

export enum AttendeeStatus {
  ACCEPTED = "ACCEPTED",
  TENTATIVE = "TENTATIVE",
  DECLINED = "DECLINED",
  NEEDS_ACTION = "NEEDS-ACTION",
}

export interface CalendarState {
  feeds: CalendarFeed[];
  events: CalendarEvent[];
  isLoading: boolean;
  error?: string;
}

export type CalendarView = "day" | "week" | "month" | "multiMonth" | "agenda";

export interface CalendarViewState {
  view: CalendarView;
  date: Date;
  selectedEventId?: string;
}

export type CalendarEventWithFeed = CalendarEvent & {
  feed: CalendarFeed;
};

export type ValidatedEvent = CalendarEvent & {
  feed: CalendarFeed & {
    accountId: string;
    url: string;
  };
  externalEventId: string;
};
