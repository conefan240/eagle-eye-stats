export type TeeColor = "red" | "white" | "yellow" | "blue";

export type Round = {
  id: string;
  holes: 9 | 18;
  courseName: string;
  tee: TeeColor;
  startedAt: number;
  savedAt?: number;
  pars: (number | null)[];
  scores: (number | null)[];
  distances: (number | null)[];
};

export const STORAGE_KEY = "fairway.round.v1";
export const SAVED_KEY = "fairway.saved.v1";

export function emptyRound(holes: 9 | 18, tee: TeeColor = "white"): Round {
  return {
    id: crypto.randomUUID(),
    holes,
    courseName: "",
    tee,
    startedAt: Date.now(),
    pars: Array(holes).fill(null),
    scores: Array(holes).fill(null),
    distances: Array(holes).fill(null),
  };
}

export const TEE_META: Record<TeeColor, { label: string; swatch: string; description: string }> = {
  red: { label: "Red", swatch: "bg-red-500", description: "Forward tees — shortest" },
  yellow: { label: "Yellow", swatch: "bg-yellow-400", description: "Middle tees" },
  white: { label: "White", swatch: "bg-white border border-border", description: "Regular tees" },
  blue: { label: "Blue", swatch: "bg-blue-500", description: "Back tees — longest" },
};

export type ScoreKind =
  | "albatross"
  | "eagle"
  | "birdie"
  | "par"
  | "bogey"
  | "double"
  | "triple+";

export function classifyScore(score: number | null, par: number | null): ScoreKind | null {
  if (score == null || par == null) return null;
  const d = score - par;
  if (d <= -3) return "albatross";
  if (d === -2) return "eagle";
  if (d === -1) return "birdie";
  if (d === 0) return "par";
  if (d === 1) return "bogey";
  if (d === 2) return "double";
  return "triple+";
}

export const SCORE_KIND_META: Record<ScoreKind, { label: string; color: string }> = {
  albatross: { label: "Albatross", color: "text-purple-600 dark:text-purple-400" },
  eagle: { label: "Eagle", color: "text-amber-600 dark:text-amber-400" },
  birdie: { label: "Birdie", color: "text-emerald-600 dark:text-emerald-400" },
  par: { label: "Par", color: "text-foreground" },
  bogey: { label: "Bogey", color: "text-orange-600 dark:text-orange-400" },
  double: { label: "Double Bogey", color: "text-rose-600 dark:text-rose-400" },
  "triple+": { label: "Triple+ Bogey", color: "text-rose-700 dark:text-rose-500" },
};
