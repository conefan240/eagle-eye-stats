import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/card";
import { SAVED_KEY, TEE_META, type Round, type TeeColor } from "@/lib/round-types";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Pinseeker" },
      { name: "description", content: "Your golfer profile: rounds played, average scores, best rounds, courses and tees." },
      { property: "og:title", content: "Profile — Pinseeker" },
      { property: "og:description", content: "Your golfer profile: rounds played, average scores, best rounds, courses and tees." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [saved, setSaved] = useState<Round[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, []);

  const rounds9 = saved.filter((r) => r.holes === 9);
  const rounds18 = saved.filter((r) => r.holes === 18);

  const totals = (list: Round[]) => {
    let scoreSum = 0, parSum = 0, played = 0;
    for (const r of list) {
      const s = r.scores.reduce<number>((a, b) => a + (b ?? 0), 0);
      const p = r.pars.reduce<number>((a, b) => a + (b ?? 0), 0);
      if (s > 0 && p > 0) { scoreSum += s; parSum += p; played++; }
    }
    return {
      played,
      avgScore: played ? scoreSum / played : 0,
      avgDiff: played ? (scoreSum - parSum) / played : 0,
    };
  };
  const t9 = totals(rounds9);
  const t18 = totals(rounds18);

  const bestRound = [...saved]
    .filter((r) => r.scores.some((s) => s != null) && r.pars.some((p) => p != null))
    .map((r) => {
      const s = r.scores.reduce<number>((a, b) => a + (b ?? 0), 0);
      const p = r.pars.reduce<number>((a, b) => a + (b ?? 0), 0);
      return { r, diff: s - p, score: s };
    })
    .sort((a, b) => a.diff - b.diff)[0];

  const courses = new Set(saved.map((r) => r.courseName).filter(Boolean));

  const teeCounts: Record<TeeColor, number> = { red: 0, yellow: 0, white: 0, blue: 0 };
  for (const r of saved) teeCounts[r.tee] = (teeCounts[r.tee] ?? 0) + 1;

  const firstDate = saved.reduce<number | null>(
    (a, r) => (a == null ? (r.savedAt ?? r.startedAt) : Math.min(a, r.savedAt ?? r.startedAt)),
    null,
  );

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader />
      <main className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 py-6">
        <h2 className="text-2xl font-bold tracking-tight">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your golf history at a glance.
        </p>

        <div className="mt-6 flex-1" />

        {/* Stats pinned near bottom of screen */}
        <section className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Rounds saved" value={saved.length} />
            <Metric label="Courses played" value={courses.size} />
            <Metric
              label="Best round"
              value={
                bestRound
                  ? `${bestRound.score} (${bestRound.diff > 0 ? "+" : ""}${bestRound.diff})`
                  : "—"
              }
            />
            <Metric
              label="Golfing since"
              value={firstDate ? new Date(firstDate).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                9-hole rounds
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <SubMetric label="Played" value={t9.played} />
                <SubMetric label="Avg score" value={t9.avgScore ? t9.avgScore.toFixed(1) : "—"} />
                <SubMetric
                  label="Avg vs par"
                  value={t9.played ? `${t9.avgDiff > 0 ? "+" : ""}${t9.avgDiff.toFixed(1)}` : "—"}
                />
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                18-hole rounds
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <SubMetric label="Played" value={t18.played} />
                <SubMetric label="Avg score" value={t18.avgScore ? t18.avgScore.toFixed(1) : "—"} />
                <SubMetric
                  label="Avg vs par"
                  value={t18.played ? `${t18.avgDiff > 0 ? "+" : ""}${t18.avgDiff.toFixed(1)}` : "—"}
                />
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tees played
            </div>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {(["red", "yellow", "white", "blue"] as TeeColor[]).map((c) => (
                <div key={c} className="flex flex-col items-center gap-1 rounded-md bg-muted/40 p-2">
                  <span className={`h-4 w-4 rounded-full ${TEE_META[c].swatch}`} />
                  <span className="text-xs capitalize text-muted-foreground">{c}</span>
                  <span className="text-lg font-semibold tabular-nums">{teeCounts[c]}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}

function SubMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
