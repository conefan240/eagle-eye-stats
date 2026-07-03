import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandHeader } from "@/components/BrandHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, THEME_KEY } from "@/lib/settings";
import { useHomeCourse, useWidgetPrefs, WIDGET_META } from "@/lib/home-course";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { LogOut, Cloud, CloudOff, Home } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Eagle Eye Stats" },
      { name: "description", content: "Change units, theme and account settings for Eagle Eye Stats." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { unit, setUnit, scoreDisplay, setScoreDisplay } = useSettings();
  const [dark, setDark] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const prefers = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const enable = stored ? stored === "dark" : !!prefers;
    setDark(enable);
    document.documentElement.classList.toggle("dark", enable);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  function toggleDark(v: boolean) {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem(THEME_KEY, v ? "dark" : "light");
  }

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <BrandHeader />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {session ? <Cloud className="h-4 w-4 text-emerald-500" /> : <CloudOff className="h-4 w-4 text-muted-foreground" />}
            Cloud saving
          </div>
          {session ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">{session.user.email ?? "Signed in"}</div>
                <div className="text-xs text-muted-foreground">
                  Your rounds sync automatically across devices.
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Sign in to back up your rounds and sync between devices.
              </p>
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Distance units</div>
          <p className="text-xs text-muted-foreground">
            How yardage/distance appears on scorecards and course listings.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["yards", "meters"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`rounded-lg border-2 p-3 text-center text-sm font-semibold capitalize transition-colors ${
                  unit === u ? "border-primary bg-accent" : "border-border hover:border-primary/50"
                }`}
              >
                {u}
                <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                  {u === "yards" ? "Standard (yds)" : "Metric (m)"}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Score display</div>
          <p className="text-xs text-muted-foreground">
            How saved-round scores appear in lists.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                { v: "vs-par", label: "Vs par", hint: "e.g. +3" },
                { v: "strokes", label: "Total strokes", hint: "e.g. 78" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => setScoreDisplay(o.v)}
                className={`rounded-lg border-2 p-3 text-center text-sm font-semibold transition-colors ${
                  scoreDisplay === o.v
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {o.label}
                <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">{o.hint}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Appearance</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { v: false, label: "Light" },
              { v: true, label: "Dark" },
            ].map((o) => (
              <button
                key={String(o.v)}
                onClick={() => toggleDark(o.v)}
                className={`rounded-lg border-2 p-3 text-center text-sm font-semibold transition-colors ${
                  dark === o.v
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
