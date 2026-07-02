import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/card";
import { classifyScore, SCORE_KIND_META, type ScoreKind } from "@/lib/round-types";
import { useSavedRounds } from "@/lib/use-saved-rounds";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Scoring Stats — Eagle Eye Stats" },
      { name: "description", content: "Total pars, birdies, eagles and bogeys across all of your saved golf rounds." },
    ],
  }),
  component: StatsPage,
});

const ORDER: ScoreKind[] = ["albatross", "eagle", "birdie", "par", "bogey", "double", "triple+"];

function StatsPage() {
  const { rounds: saved, session } = useSavedRounds();

  const counts: Record<ScoreKind, number> = {
    albatross: 0, eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, "triple+": 0,
  };
  let totalHolesScored = 0;
  for (const r of saved) {
    for (let i = 0; i < r.holes; i++) {
      const k = classifyScore(r.scores?.[i] ?? null, r.pars?.[i] ?? null);
      if (k) { counts[k]++; totalHolesScored++; }
    }
  }
  const max = Math.max(1, ...ORDER.map((k) => counts[k]));

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h2 className="text-2xl font-bold tracking-tight">Scoring Stats</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Across {saved.length} saved round{saved.length === 1 ? "" : "s"} · {totalHolesScored} holes scored.
          {!session && (
            <>
              {" "}
              <Link to="/auth" className="underline hover:text-foreground">
                Sign in
              </Link>{" "}
              to sync across devices.
            </>
          )}
        </p>

        {totalHolesScored === 0 ? (
          <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
            No completed holes yet. Save a round with pars and scores to see your stats.
          </Card>
        ) : (
          <Card className="mt-6 divide-y">
            {ORDER.map((k) => {
              const c = counts[k];
              const pct = totalHolesScored ? (c / totalHolesScored) * 100 : 0;
              const bar = (c / max) * 100;
              return (
                <div key={k} className="flex items-center gap-4 px-4 py-3">
                  <div className={`w-32 text-sm font-semibold ${SCORE_KIND_META[k].color}`}>
                    {SCORE_KIND_META[k].label}
                  </div>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={{ width: `${bar}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm tabular-nums">
                    <span className="font-semibold">{c}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </main>
    </div>
  );
}
