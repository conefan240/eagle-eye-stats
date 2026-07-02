import { useEffect, useState } from "react";

export type DistanceUnit = "yards" | "meters";
export type ScoreDisplay = "vs-par" | "strokes";

const UNIT_KEY = "eagleeye.unit.v1";
const SCORE_KEY = "eagleeye.scoreDisplay.v1";
const THEME_KEY = "eagleeye.theme";

export function getUnit(): DistanceUnit {
  if (typeof window === "undefined") return "yards";
  const v = localStorage.getItem(UNIT_KEY);
  return v === "meters" ? "meters" : "yards";
}

export function getScoreDisplay(): ScoreDisplay {
  if (typeof window === "undefined") return "vs-par";
  const v = localStorage.getItem(SCORE_KEY);
  return v === "strokes" ? "strokes" : "vs-par";
}

export function useSettings() {
  const [unit, setUnitState] = useState<DistanceUnit>("yards");
  const [scoreDisplay, setScoreDisplayState] = useState<ScoreDisplay>("vs-par");

  useEffect(() => {
    setUnitState(getUnit());
    setScoreDisplayState(getScoreDisplay());
  }, []);

  return {
    unit,
    setUnit: (u: DistanceUnit) => {
      setUnitState(u);
      localStorage.setItem(UNIT_KEY, u);
    },
    scoreDisplay,
    setScoreDisplay: (s: ScoreDisplay) => {
      setScoreDisplayState(s);
      localStorage.setItem(SCORE_KEY, s);
    },
  };
}

/** Convert yards (canonical storage) to selected unit. */
export function convertDistance(yards: number, unit: DistanceUnit): number {
  return unit === "meters" ? Math.round(yards * 0.9144) : yards;
}

export function unitLabel(unit: DistanceUnit): string {
  return unit === "meters" ? "m" : "yds";
}

export { THEME_KEY };
