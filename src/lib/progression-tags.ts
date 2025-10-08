import { StatKey } from "@/types/stats";

type ProgressionTagDefinition = {
  id: string;
  label: string;
  description: string;
  statKey: StatKey;
  taskType: string;
  accent: string;
};

export const PROGRESSION_TAGS: ProgressionTagDefinition[] = [
  {
    id: "sport",
    label: "Sport",
    description: "Training, Laufen oder jede Form von Bewegung.",
    statKey: "endurance",
    taskType: "Sport",
    accent: "#22c55e",
  },
  {
    id: "uni",
    label: "Uni / Studium",
    description: "Vorlesungen, Seminare und Lern-Sessions.",
    statKey: "focus",
    taskType: "Uni",
    accent: "#6366f1",
  },
  {
    id: "work",
    label: "Arbeit",
    description: "Berufliche Termine oder Deep Work.",
    statKey: "focus",
    taskType: "Arbeit",
    accent: "#f97316",
  },
  {
    id: "social",
    label: "Soziales",
    description: "Freunde treffen, Calls, Community.",
    statKey: "social",
    taskType: "Soziales",
    accent: "#ec4899",
  },
  {
    id: "creative",
    label: "Kreativ",
    description: "Design, Schreiben, Musik oder Kunst.",
    statKey: "creativity",
    taskType: "Kreativ",
    accent: "#a855f7",
  },
  {
    id: "wellbeing",
    label: "Selfcare",
    description: "Meditation, Wellness, Pause.",
    statKey: "wellbeing",
    taskType: "Selfcare",
    accent: "#06b6d4",
  },
  {
    id: "admin",
    label: "Organisation",
    description: "Planung, Mails, kleinere Admin-Aufgaben.",
    statKey: "focus",
    taskType: "Admin",
    accent: "#facc15",
  },
];

export function getProgressionTag(tagId?: string | null) {
  if (!tagId) return undefined;
  return PROGRESSION_TAGS.find((tag) => tag.id === tagId);
}

export type { ProgressionTagDefinition };
