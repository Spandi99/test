import { DailyActivityDefinition, StatKey, WeekdayKey } from "@/types/stats";

export interface StatDefinition {
  key: StatKey;
  label: string;
  description: string;
  emoji: string;
  gradient: string;
  accentColor: string;
}

export const STAT_DEFINITIONS: Record<StatKey, StatDefinition> = {
  focus: {
    key: "focus",
    label: "Fokus",
    description:
      "Wie gut du dich auf wichtige Arbeit konzentrieren kannst und Projekte vorantreibst.",
    emoji: "🧠",
    gradient: "from-sky-400 via-blue-500 to-indigo-500",
    accentColor: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  },
  endurance: {
    key: "endurance",
    label: "Ausdauer",
    description:
      "Deine physische und mentale Belastbarkeit für lange oder anspruchsvolle Aufgaben.",
    emoji: "🏃",
    gradient: "from-emerald-400 via-green-500 to-lime-500",
    accentColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  creativity: {
    key: "creativity",
    label: "Kreativität",
    description:
      "Wie leicht es dir fällt, neue Ideen zu entwickeln und Dinge anders zu sehen.",
    emoji: "🎨",
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    accentColor: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
  },
  social: {
    key: "social",
    label: "Sozial",
    description:
      "Deine Fähigkeit, Beziehungen zu pflegen, Netzwerke zu aktivieren und gemeinsam Lösungen zu finden.",
    emoji: "🤝",
    gradient: "from-fuchsia-400 via-purple-500 to-pink-500",
    accentColor: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  },
  wellbeing: {
    key: "wellbeing",
    label: "Wohlbefinden",
    description:
      "Wie ausgeglichen, erholt und zufrieden du dich im Alltag fühlst.",
    emoji: "🌿",
    gradient: "from-teal-400 via-cyan-500 to-blue-500",
    accentColor: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  },
};

export const DAILY_ACTIVITIES: Record<WeekdayKey, DailyActivityDefinition[]> = {
  monday: [
    {
      id: "deep-focus-sprint",
      label: "Deep-Work-Sprint",
      description: "90 Minuten fokussierte Arbeit ohne Ablenkung.",
      statKey: "focus",
      amount: 2,
      xpReward: 45,
      emoji: "🧠",
    },
    {
      id: "mobility-reset",
      label: "Mobility Reset",
      description: "15 Minuten Stretching oder Yoga für einen beweglichen Start.",
      statKey: "endurance",
      amount: 1,
      xpReward: 25,
      emoji: "🧘",
    },
    {
      id: "weekly-planning",
      label: "Wochenplanung",
      description: "Plane die wichtigsten Ziele und priorisiere deine Aufgaben.",
      statKey: "wellbeing",
      amount: 1,
      xpReward: 20,
      emoji: "🗂️",
    },
  ],
  tuesday: [
    {
      id: "tempo-run",
      label: "Cardio oder Joggen",
      description: "30 Minuten Cardio für mehr Energie.",
      statKey: "endurance",
      amount: 2,
      xpReward: 40,
      emoji: "🏃",
    },
    {
      id: "brainstorm-session",
      label: "Brainstorming",
      description: "15 Minuten Ideen sammeln und frei denken.",
      statKey: "creativity",
      amount: 1,
      xpReward: 25,
      emoji: "💡",
    },
    {
      id: "social-check-in",
      label: "Catch-up Call",
      description: "Melde dich bei einem Freund oder Teammitglied.",
      statKey: "social",
      amount: 1,
      xpReward: 20,
      emoji: "📞",
    },
  ],
  wednesday: [
    {
      id: "learning-hour",
      label: "Lernstunde",
      description: "60 Minuten etwas Neues lernen oder ein Tutorial folgen.",
      statKey: "focus",
      amount: 1,
      xpReward: 30,
      emoji: "📚",
    },
    {
      id: "creative-prototype",
      label: "Kreatives Mini-Projekt",
      description: "Erstelle einen kleinen Prototypen oder Entwurf.",
      statKey: "creativity",
      amount: 2,
      xpReward: 45,
      emoji: "🛠️",
    },
    {
      id: "wellness-break",
      label: "Achtsamkeits-Pause",
      description: "10 Minuten Meditation oder Atemübung.",
      statKey: "wellbeing",
      amount: 1,
      xpReward: 20,
      emoji: "🧘",
    },
  ],
  thursday: [
    {
      id: "strength-training",
      label: "Krafttraining",
      description: "Ein kurzes Ganzkörper-Workout oder Kraftsession.",
      statKey: "endurance",
      amount: 2,
      xpReward: 40,
      emoji: "💪",
    },
    {
      id: "knowledge-share",
      label: "Wissensaustausch",
      description: "Teile deine Learnings mit jemandem im Team.",
      statKey: "social",
      amount: 1,
      xpReward: 25,
      emoji: "🧩",
    },
    {
      id: "reflective-journal",
      label: "Reflexions-Journal",
      description: "Notiere 3 Dinge, die heute gut gelaufen sind.",
      statKey: "wellbeing",
      amount: 1,
      xpReward: 20,
      emoji: "📓",
    },
  ],
  friday: [
    {
      id: "ship-feature",
      label: "Feature abschließen",
      description: "Beende ein wichtiges Wochen-Highlight.",
      statKey: "focus",
      amount: 2,
      xpReward: 50,
      emoji: "🚀",
    },
    {
      id: "celebrate-team",
      label: "Team-Erfolg feiern",
      description: "Starte eine kleine Anerkennungsrunde fürs Team.",
      statKey: "social",
      amount: 1,
      xpReward: 25,
      emoji: "🎉",
    },
    {
      id: "wind-down",
      label: "Wochenabschluss",
      description: "Plane bewusst Erholung für das Wochenende.",
      statKey: "wellbeing",
      amount: 1,
      xpReward: 20,
      emoji: "🛀",
    },
  ],
  saturday: [
    {
      id: "adventure-outdoor",
      label: "Outdoor-Abenteuer",
      description: "Geh wandern, radeln oder für einen langen Spaziergang raus.",
      statKey: "endurance",
      amount: 2,
      xpReward: 45,
      emoji: "🥾",
    },
    {
      id: "creative-play",
      label: "Kreatives Spielen",
      description: "Zeichnen, Musik machen oder etwas basteln.",
      statKey: "creativity",
      amount: 2,
      xpReward: 40,
      emoji: "🎶",
    },
    {
      id: "quality-time",
      label: "Quality Time",
      description: "Verbringe bewusste Zeit mit Familie oder Freunden.",
      statKey: "social",
      amount: 1,
      xpReward: 25,
      emoji: "❤️",
    },
  ],
  sunday: [
    {
      id: "reset-ritual",
      label: "Sonntags-Ritual",
      description: "Bereite Mahlzeiten vor oder organisiere die Woche.",
      statKey: "wellbeing",
      amount: 2,
      xpReward: 35,
      emoji: "🧺",
    },
    {
      id: "long-read",
      label: "Langer Artikel oder Buch",
      description: "Lies etwas Inspirierendes für mindestens 30 Minuten.",
      statKey: "focus",
      amount: 1,
      xpReward: 25,
      emoji: "📖",
    },
    {
      id: "light-movement",
      label: "Leichte Bewegung",
      description: "Ein Spaziergang oder lockeres Stretching zum Runterkommen.",
      statKey: "endurance",
      amount: 1,
      xpReward: 20,
      emoji: "🚶",
    },
  ],
};

export const TASK_KEYWORD_MAP: Array<{ patterns: RegExp[]; statKey: StatKey }> = [
  {
    statKey: "endurance",
    patterns: [
      /jogg/i,
      /run/i,
      /lauf/i,
      /sport/i,
      /gym/i,
      /training/i,
      /workout/i,
      /yoga/i,
      /pilates/i,
      /bike/i,
      /rad/i,
      /swim/i,
      /spazier/i,
    ],
  },
  {
    statKey: "creativity",
    patterns: [
      /design/i,
      /sketch/i,
      /zeichn/i,
      /paint/i,
      /schreib/i,
      /write/i,
      /brainstorm/i,
      /kreativ/i,
      /musik/i,
      /compose/i,
      /film/i,
      /video/i,
    ],
  },
  {
    statKey: "social",
    patterns: [
      /call/i,
      /meeting/i,
      /meet/i,
      /coffee/i,
      /lunch/i,
      /dinner/i,
      /catch[- ]?up/i,
      /network/i,
      /team/i,
      /sync/i,
    ],
  },
  {
    statKey: "wellbeing",
    patterns: [
      /medit/i,
      /therapy/i,
      /arzt/i,
      /doctor/i,
      /gesund/i,
      /sleep/i,
      /rest/i,
      /erhol/i,
      /spa/i,
      /massage/i,
    ],
  },
];

export const BASE_TASK_XP = 35;
export const XP_PER_ESTIMATED_MINUTE = 0.2;
export const MAX_TASK_XP_BONUS = 40;

export function getXpForLevel(level: number): number {
  return 120 + (level - 1) * 45;
}

export function getWeekdayKey(date: Date): WeekdayKey {
  const index = date.getDay();
  const keys: WeekdayKey[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return keys[index];
}
