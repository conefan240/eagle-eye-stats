import { useEffect, useState } from "react";
import type { CourseSuggestion } from "./suggest-courses.functions";

const HOME_KEY = "eagleeye.homeCourse.v1";
const WIDGETS_KEY = "eagleeye.widgets.v1";

export type HomeCourse = {
  name: string;
  suggestion?: CourseSuggestion;
};

export function getHomeCourse(): HomeCourse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HOME_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.name) return null;
    return p as HomeCourse;
  } catch {
    return null;
  }
}

export function setHomeCourse(hc: HomeCourse | null) {
  if (typeof window === "undefined") return;
  if (!hc || !hc.name) localStorage.removeItem(HOME_KEY);
  else localStorage.setItem(HOME_KEY, JSON.stringify(hc));
}

export function useHomeCourse() {
  const [hc, setHc] = useState<HomeCourse | null>(null);
  useEffect(() => {
    setHc(getHomeCourse());
    const onStorage = (e: StorageEvent) => {
      if (e.key === HOME_KEY) setHc(getHomeCourse());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return {
    homeCourse: hc,
    setHomeCourse: (v: HomeCourse | null) => {
      setHomeCourse(v);
      setHc(v);
    },
  };
}

export type WidgetPrefs = {
  upload: boolean;
  newRound: boolean;
  lastRound: boolean;
  homeCourse: boolean;
};

const WIDGET_DEFAULTS: WidgetPrefs = {
  upload: true,
  newRound: true,
  lastRound: true,
  homeCourse: true,
};

export function getWidgetPrefs(): WidgetPrefs {
  if (typeof window === "undefined") return WIDGET_DEFAULTS;
  try {
    const raw = localStorage.getItem(WIDGETS_KEY);
    if (!raw) return WIDGET_DEFAULTS;
    return { ...WIDGET_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return WIDGET_DEFAULTS;
  }
}

export function useWidgetPrefs() {
  const [prefs, setPrefs] = useState<WidgetPrefs>(WIDGET_DEFAULTS);
  useEffect(() => {
    setPrefs(getWidgetPrefs());
    const onStorage = (e: StorageEvent) => {
      if (e.key === WIDGETS_KEY) setPrefs(getWidgetPrefs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return {
    prefs,
    setPref: (k: keyof WidgetPrefs, v: boolean) => {
      const next = { ...prefs, [k]: v };
      setPrefs(next);
      localStorage.setItem(WIDGETS_KEY, JSON.stringify(next));
    },
  };
}

export const WIDGET_META: { id: keyof WidgetPrefs; label: string; hint: string }[] = [
  { id: "upload", label: "Upload card", hint: "Quick scan a scorecard photo" },
  { id: "newRound", label: "New round", hint: "Start a round in one tap" },
  { id: "homeCourse", label: "Home course", hint: "Jump straight into your home course" },
  { id: "lastRound", label: "Last round", hint: "See your most recent score" },
];
