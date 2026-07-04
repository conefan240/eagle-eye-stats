import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { scanScorecard, type ScanResult } from "@/lib/scan-scorecard.functions";
import { type CourseSuggestion } from "@/lib/suggest-courses.functions";
import { CourseAutocomplete } from "@/components/CourseAutocomplete";
import {
  emptyRound,
  STORAGE_KEY,
  TEE_META,
  type Round,
  type TeeColor,
} from "@/lib/round-types";
import { useSavedRounds } from "@/lib/use-saved-rounds";
import { useSettings, convertDistance, unitLabel, THEME_KEY } from "@/lib/settings";
import { useHomeCourse, useWidgetPrefs, type HomeCourse } from "@/lib/home-course";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Camera, Plus, Loader2, Save, Trash2, Upload, Moon, Sun, Flag, Pencil, ScanLine, Home, Search, X } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const PLAYER_NAME_KEY = "fairway.playerName";

function Index() {
  const [round, setRound] = useState<Round | null>(null);
  const { rounds: saved, upsert, remove } = useSavedRounds();
  const { unit } = useSettings();
  const { homeCourse, setHomeCourse } = useHomeCourse();
  const { prefs: widgets } = useWidgetPrefs();
  const [showNew, setShowNew] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const quickFileRef = useRef<HTMLInputElement>(null);
  const [dark, setDark] = useState(false);

  const [playerName, setPlayerName] = useState<string>("");
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [homeCourseDraft, setHomeCourseDraft] = useState("");
  const [homeCoursePicked, setHomeCoursePicked] = useState<CourseSuggestion | null>(null);
  const [isFirstRun, setIsFirstRun] = useState(false);

  // Post-scan flow: uploaded card before starting a round
  const [pendingScan, setPendingScan] = useState<ScanResult | null>(null);
  const [showPostScan, setShowPostScan] = useState(false);

  // Filters for saved rounds list
  const [filterQuery, setFilterQuery] = useState("");
  const [filterTee, setFilterTee] = useState<"all" | TeeColor>("all");
  const [filterHoles, setFilterHoles] = useState<"all" | 9 | 18>("all");

  // Whether we're past the "scan first" step for the current round
  const [entryStarted, setEntryStarted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const prefers = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const enable = stored ? stored === "dark" : !!prefers;
    setDark(enable);
    document.documentElement.classList.toggle("dark", enable);
  }, []);

  useEffect(() => {
    const n = localStorage.getItem(PLAYER_NAME_KEY) ?? "";
    setPlayerName(n);
    if (!n) {
      setNameDraft("");
      setHomeCourseDraft("");
      setHomeCoursePicked(null);
      setIsFirstRun(true);
      setShowNameDialog(true);
    }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const r = migrate(JSON.parse(raw));
        setRound(r);
        // If they've already recorded any scores, skip the scan-first gate
        setEntryStarted(r.scores.some((s) => s != null));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (round) localStorage.setItem(STORAGE_KEY, JSON.stringify(round));
    else localStorage.removeItem(STORAGE_KEY);
  }, [round]);

  async function saveRound() {
    if (!round) return;
    const toSave: Round = { ...round, savedAt: Date.now() };
    await upsert(toSave);
    setRound(null);
    setEntryStarted(false);
    toast.success("Round saved");
  }

  function deleteSaved(id: string) {
    remove(id);
  }

  const totals = useMemo(() => {
    if (!round) return { score: 0, par: 0, diff: 0, played: 0, yards: 0 };
    const score = round.scores.reduce<number>((a, b) => a + (b ?? 0), 0);
    const par = round.pars.reduce<number>((a, b) => a + (b ?? 0), 0);
    const yards = round.distances.reduce<number>((a, b) => a + (b ?? 0), 0);
    const played = round.scores.filter((s) => s != null).length;
    return { score, par, diff: score - par, played, yards };
  }, [round]);

  function startRound(
    holes: 9 | 18,
    tee: TeeColor,
    courseName = "",
    pars?: (number | null)[],
    distances?: (number | null)[],
  ) {
    const r = emptyRound(holes, tee);
    r.courseName = courseName;
    if (pars && pars.length === holes) r.pars = pars.slice();
    if (distances && distances.length === holes) r.distances = distances.slice();
    setRound(r);
    setEntryStarted(false);
    setShowNew(false);
  }

  function updateScore(i: number, v: string) {
    if (!round) return;
    const n = v === "" ? null : Math.max(1, Math.min(20, parseInt(v, 10) || 0));
    const next = [...round.scores];
    next[i] = n;
    setRound({ ...round, scores: next });
  }
  function updatePar(i: number, v: string) {
    if (!round) return;
    const n = v === "" ? null : Math.max(3, Math.min(6, parseInt(v, 10) || 0));
    const next = [...round.pars];
    next[i] = n;
    setRound({ ...round, pars: next });
  }

  async function handleFile(file: File) {
    if (!round) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB)");
      return;
    }
    setScanning(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const result = await scanScorecard({
        data: {
          imageDataUrl: dataUrl,
          holes: round.holes,
          playerName: playerName || undefined,
        },
      });
      setRound({
        ...round,
        courseName: result.courseName || round.courseName,
        pars: result.pars?.map((p, i) => p ?? round.pars[i]) ?? round.pars,
        scores: result.scores.map((s, i) => s ?? round.scores[i]),
      });
      setEntryStarted(true);
      if (result.matchedPlayer) {
        toast.success(`Scanned — matched: ${result.matchedPlayer}`);
      } else if (playerName) {
        toast.warning(`Couldn't find "${playerName}" on the card — used the most prominent column`);
      } else {
        toast.success("Scorecard scanned");
      }
    } catch (e: any) {
      toast.error(e?.message || "Scan failed");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      if (quickFileRef.current) quickFileRef.current.value = "";
    }
  }

  function saveName() {
    const n = nameDraft.trim();
    if (!n) {
      toast.error("Please enter your name");
      return;
    }
    localStorage.setItem(PLAYER_NAME_KEY, n);
    setPlayerName(n);
    const hc = homeCourseDraft.trim();
    if (isFirstRun && hc) {
      setHomeCourse({ name: hc, suggestion: homeCoursePicked ?? undefined });
    }
    setShowNameDialog(false);
    setIsFirstRun(false);
    toast.success("Saved");
  }

  function startHomeCourseRound() {
    if (!homeCourse) return;
    const s = homeCourse.suggestion;
    const tee: TeeColor = "white";
    const teeData = s?.tees?.[tee];
    startRound(
      18,
      tee,
      homeCourse.name,
      teeData?.pars ?? s?.pars,
      teeData?.distances,
    );
  }

  function openQuickScan() {
    // Always allow uploading first — if no round is in progress, we'll
    // capture course/holes/tees after the scan.
    quickFileRef.current?.click();
  }

  async function handleQuickFile(file: File) {
    // If there's already a round, just fill it in.
    if (round) {
      await handleFile(file);
      return;
    }
    // Otherwise: scan first (default to 18 holes), then ask course/holes/tees.
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB)");
      if (quickFileRef.current) quickFileRef.current.value = "";
      return;
    }
    setScanning(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const result = await scanScorecard({
        data: {
          imageDataUrl: dataUrl,
          holes: 18,
          playerName: playerName || undefined,
        },
      });
      setPendingScan(result);
      setShowPostScan(true);
      if (result.matchedPlayer) {
        toast.success(`Scanned — matched: ${result.matchedPlayer}`);
      } else if (playerName) {
        toast.warning(`Couldn't find "${playerName}" on the card — used the most prominent column`);
      } else {
        toast.success("Scorecard scanned");
      }
    } catch (e: any) {
      toast.error(e?.message || "Scan failed");
    } finally {
      setScanning(false);
      if (quickFileRef.current) quickFileRef.current.value = "";
    }
  }

  function finalizePostScan(
    holes: 9 | 18,
    tee: TeeColor,
    courseName: string,
    pars?: (number | null)[],
    distances?: (number | null)[],
  ) {
    if (!pendingScan) return;
    const r = emptyRound(holes, tee);
    r.courseName = courseName || pendingScan.courseName || "";
    // Course-supplied pars first, then scan-detected pars as fallback per hole
    const scanPars = (pendingScan.pars ?? []).slice(0, holes);
    r.pars = Array.from({ length: holes }, (_, i) => pars?.[i] ?? scanPars[i] ?? null);
    r.scores = Array.from(
      { length: holes },
      (_, i) => pendingScan.scores[i] ?? null,
    );
    if (distances && distances.length === holes) r.distances = distances.slice();
    setRound(r);
    setEntryStarted(true);
    setPendingScan(null);
    setShowPostScan(false);
    toast.success("Round created from scanned card");
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <BrandHeader
        right={
          <>
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <button
              onClick={() => {
                setNameDraft(playerName);
                setIsFirstRun(false);
                setShowNameDialog(true);
              }}
              className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
              aria-label="Edit your name"
            >
              <span className="max-w-[120px] truncate">{playerName || "Set name"}</span>
              <Pencil className="h-3 w-3" />
            </button>
          </>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <input
          ref={quickFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleQuickFile(f);
          }}
        />

        {/* Customizable dashboard widgets */}
        {(widgets.upload || widgets.newRound || widgets.homeCourse || widgets.lastRound) && (
          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dashboard
              </h2>
              <Link
                to="/settings"
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Customize
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {widgets.upload && (
                <WidgetTile
                  icon={<ScanLine className="h-5 w-5" />}
                  label="Upload card"
                  hint={round ? "Auto-fill this round" : "Snap a card first"}
                  onClick={openQuickScan}
                  loading={scanning}
                />
              )}
              {widgets.newRound && (
                <WidgetTile
                  icon={<Plus className="h-5 w-5" />}
                  label="New round"
                  hint={homeCourse ? `Prefilled: ${homeCourse.name}` : "Pick course & tees"}
                  onClick={() => setShowNew(true)}
                />
              )}
              {widgets.homeCourse && homeCourse && (
                <WidgetTile
                  icon={<Home className="h-5 w-5" />}
                  label={homeCourse.name}
                  hint="Start 18 · white tees"
                  onClick={startHomeCourseRound}
                />
              )}
              {widgets.lastRound && saved[0] && (
                <WidgetTile
                  icon={<Flag className="h-5 w-5" />}
                  label={`Last: ${saved[0].courseName || "Round"}`}
                  hint={(() => {
                    const s = saved[0].scores.reduce<number>((a, b) => a + (b ?? 0), 0);
                    const p = saved[0].pars.reduce<number>((a, b) => a + (b ?? 0), 0);
                    const d = s - p;
                    return `${s || "—"} · ${p ? (d > 0 ? `+${d}` : d === 0 ? "E" : `${d}`) : "—"}`;
                  })()}
                  onClick={() => {
                    setRound(saved[0]);
                    setEntryStarted(true);
                  }}
                />
              )}
            </div>
          </section>
        )}


        {!round ? (
          <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <Flag className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold">No round in progress</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a new round to begin tracking your scores.
              </p>
            </div>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="mr-1 h-4 w-4" /> Start new round
            </Button>
          </Card>
        ) : !entryStarted ? (
          <Card className="p-6">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {round.courseName || "New round"} · {round.holes} holes ·{" "}
                <span className="capitalize">{round.tee} tees</span>
              </div>
              <h2 className="mt-1 text-xl font-semibold">Scan your scorecard</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Finish the round on paper, then snap the card and we'll fill it in automatically.
                You can fix anything after.
              </p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="lg"
                className="flex-1"
                onClick={() => cameraRef.current?.click()}
                disabled={scanning}
              >
                {scanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning…
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-5 w-5" /> Take photo
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1"
                onClick={() => fileRef.current?.click()}
                disabled={scanning}
              >
                <Upload className="mr-2 h-5 w-5" /> Upload image
              </Button>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => setEntryStarted(true)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Enter manually instead
              </button>
            </div>

            {playerName && (
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Scans will match against <span className="font-medium text-foreground">{playerName}</span>
              </p>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[180px] flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Course</label>
                  <Input
                    value={round.courseName}
                    onChange={(e) => setRound({ ...round, courseName: e.target.value })}
                    placeholder="Course name"
                    className="mt-1"
                  />
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${TEE_META[round.tee].swatch}`}
                    />
                    <span className="font-medium capitalize text-foreground">
                      {round.tee} tees
                    </span>
                    {totals.yards > 0 && (
                      <span>· {convertDistance(totals.yards, unit)} {unitLabel(unit)} total</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat label="Holes" value={`${totals.played}/${round.holes}`} />
                  <Stat label="Score" value={totals.score || "—"} />
                  <Stat
                    label="vs Par"
                    value={
                      totals.par ? (totals.diff > 0 ? `+${totals.diff}` : `${totals.diff}`) : "—"
                    }
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <Button variant="outline" onClick={() => cameraRef.current?.click()} disabled={scanning}>
                  {scanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning…
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-4 w-4" /> Rescan
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={scanning}>
                  <Upload className="mr-2 h-4 w-4" /> Upload image
                </Button>
                <Button variant="secondary" onClick={saveRound}>
                  <Save className="mr-2 h-4 w-4" /> Save round
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm("Clear all scores for this round?")) {
                      setRound({ ...round, scores: Array(round.holes).fill(null) });
                    }
                  }}
                >
                  Clear scores
                </Button>
              </div>
            </Card>

            <ScorecardTable round={round} updateScore={updateScore} updatePar={updatePar} unit={unit} />
          </div>
        )}

        {saved.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Saved rounds
              </h2>
              <span className="text-xs text-muted-foreground">
                {(() => {
                  const filtered = saved.filter((r) => {
                    if (filterTee !== "all" && r.tee !== filterTee) return false;
                    if (filterHoles !== "all" && r.holes !== filterHoles) return false;
                    if (filterQuery.trim() && !r.courseName.toLowerCase().includes(filterQuery.trim().toLowerCase())) return false;
                    return true;
                  });
                  return `${filtered.length} / ${saved.length}`;
                })()}
              </span>
            </div>

            {/* Filters */}
            <Card className="mb-3 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search by course…"
                    className="h-8 pl-7 pr-7 text-sm"
                  />
                  {filterQuery && (
                    <button
                      onClick={() => setFilterQuery("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex gap-1">
                  {(["all", 9, 18] as const).map((h) => (
                    <button
                      key={String(h)}
                      onClick={() => setFilterHoles(h)}
                      className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                        filterHoles === h
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {h === "all" ? "All" : `${h}`}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFilterTee("all")}
                    className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                      filterTee === "all"
                        ? "border-primary bg-accent"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    All
                  </button>
                  {(["red", "yellow", "white", "blue"] as TeeColor[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setFilterTee(c)}
                      className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                        filterTee === c
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary/50"
                      }`}
                      aria-label={`Filter ${c} tees`}
                    >
                      <span className={`h-3 w-3 rounded-full ${TEE_META[c].swatch}`} />
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              {saved
                .filter((r) => {
                  if (filterTee !== "all" && r.tee !== filterTee) return false;
                  if (filterHoles !== "all" && r.holes !== filterHoles) return false;
                  if (
                    filterQuery.trim() &&
                    !r.courseName.toLowerCase().includes(filterQuery.trim().toLowerCase())
                  )
                    return false;
                  return true;
                })
                .map((r) => {
                  const score = r.scores.reduce<number>((a, b) => a + (b ?? 0), 0);
                  const par = r.pars.reduce<number>((a, b) => a + (b ?? 0), 0);
                  const diff = score - par;
                  const date = new Date(r.savedAt ?? r.startedAt);
                  const dateStr = date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  return (
                    <Card
                      key={r.id}
                      className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/40"
                    >
                      <button
                        onClick={() => {
                          setRound(r);
                          setEntryStarted(true);
                        }}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {r.holes}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">
                            {r.courseName || "Unnamed course"}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                              className={`inline-block h-2.5 w-2.5 rounded-full ${TEE_META[r.tee].swatch}`}
                            />
                            <span className="capitalize">{r.tee} tees</span>
                            <span>·</span>
                            <span>{dateStr}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-semibold tabular-nums">{score || "—"}</div>
                          <div className="text-xs tabular-nums text-muted-foreground">
                            {par ? (diff > 0 ? `+${diff}` : diff === 0 ? "E" : `${diff}`) : "—"}
                          </div>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this saved round?")) deleteSaved(r.id);
                        }}
                        aria-label="Delete round"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </Card>
                  );
                })}
            </div>
          </section>
        )}
      </main>

      <NewRoundDialog
        open={showNew}
        onOpenChange={setShowNew}
        hasCurrentRound={!!round}
        onStart={startRound}
        defaultCourse={homeCourse}
      />

      <NewRoundDialog
        open={showPostScan}
        onOpenChange={(v) => {
          setShowPostScan(v);
          if (!v) setPendingScan(null);
        }}
        hasCurrentRound={!!round}
        onStart={finalizePostScan}
        defaultCourse={
          pendingScan?.courseName
            ? { name: pendingScan.courseName }
            : homeCourse
        }
        title="Confirm scanned round"
        description="We scanned your card. Pick the course, holes and tees you played."
        submitLabel="Create round"
      />

      <Dialog
        open={showNameDialog}
        onOpenChange={(v) => {
          // Block dismiss on first-open flow
          if (!v && !playerName) return;
          setShowNameDialog(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isFirstRun ? "Welcome to Eagle Eye Stats" : "Edit your name"}</DialogTitle>
            <DialogDescription>
              We use your name to pick the right column when scanning multi-player scorecards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Full name</label>
              <Input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="e.g. Colm Fanning"
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isFirstRun) saveName();
                }}
              />
            </div>
            {isFirstRun && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Home course <span className="text-muted-foreground/70">(optional)</span>
                </label>
                <div className="mt-1">
                  <CourseAutocomplete
                    query={homeCourseDraft}
                    onQueryChange={(v) => {
                      setHomeCourseDraft(v);
                      setHomeCoursePicked(null);
                    }}
                    picked={homeCoursePicked}
                    onPick={(s) => {
                      setHomeCoursePicked(s);
                      setHomeCourseDraft(s.name);
                    }}
                    holes={18}
                    placeholder="e.g. Royal Portrush"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  We'll prefill this when you start a new round or scan a card. You can still
                  search for other courses too, and change this later in Settings.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveName}>{isFirstRun ? "Get started" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Backfill older localStorage rounds without tee/distances
function migrate(r: any): Round {
  return {
    id: r.id ?? crypto.randomUUID(),
    holes: r.holes === 9 ? 9 : 18,
    courseName: r.courseName ?? "",
    tee: (r.tee as TeeColor) ?? "white",
    startedAt: r.startedAt ?? Date.now(),
    savedAt: r.savedAt,
    pars: Array.isArray(r.pars) ? r.pars : Array(r.holes ?? 18).fill(null),
    scores: Array.isArray(r.scores) ? r.scores : Array(r.holes ?? 18).fill(null),
    distances: Array.isArray(r.distances) ? r.distances : Array(r.holes ?? 18).fill(null),
  };
}

function NewRoundDialog({
  open,
  onOpenChange,
  hasCurrentRound,
  onStart,
  defaultCourse,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hasCurrentRound: boolean;
  onStart: (
    holes: 9 | 18,
    tee: TeeColor,
    courseName?: string,
    pars?: (number | null)[],
    distances?: (number | null)[],
  ) => void;
  defaultCourse?: HomeCourse | null;
}) {
  const [holes, setHoles] = useState<9 | 18>(18);
  const [tee, setTee] = useState<TeeColor>("white");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CourseSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery(defaultCourse?.name ?? "");
      setPicked(defaultCourse?.suggestion ?? null);
      setSuggestions([]);
      setHoles(18);
      setTee("white");
    }
  }, [open, defaultCourse]);


  useEffect(() => {
    if (picked && picked.name === query) return;
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await suggestCourses({ data: { query: q, holes } });
        if (!cancelled) setSuggestions(res.suggestions);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, holes, picked]);

  function pick(s: CourseSuggestion) {
    setPicked(s);
    setQuery(s.name);
    setSuggestions([]);
  }

  function handleStart() {
    let pars = picked?.pars;
    let distances: (number | null)[] | undefined;
    if (picked) {
      const teeData = picked.tees?.[tee];
      if (teeData) {
        pars = teeData.pars ?? pars;
        distances = teeData.distances;
      }
    }
    onStart(holes, tee, picked?.name || query.trim(), pars, distances);
  }

  const teeYards = useMemo(() => {
    const d = picked?.tees?.[tee]?.distances;
    if (!d) return 0;
    return d.reduce<number>((a, b) => a + (b ?? 0), 0);
  }, [picked, tee]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start new round</DialogTitle>
          <DialogDescription>
            Pick your course, how many holes, and which tees you're playing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Course</label>
            <div className="relative mt-1">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPicked(null);
                }}
                placeholder="Start typing a course name…"
                autoFocus
              />
              {(loading || suggestions.length > 0) && !picked && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
                  {loading && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching courses…
                    </div>
                  )}
                  {suggestions.map((s, i) => {
                    const parSum = s.pars.reduce<number>((a, b) => a + (b ?? 0), 0);
                    return (
                      <button
                        key={i}
                        onClick={() => pick(s)}
                        className="flex w-full items-center justify-between gap-2 border-t px-3 py-2 text-left text-sm first:border-t-0 hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{s.name}</div>
                          {s.location && (
                            <div className="truncate text-xs text-muted-foreground">
                              {s.location}
                            </div>
                          )}
                        </div>
                        {parSum > 0 && (
                          <div className="text-xs tabular-nums text-muted-foreground">
                            Par {parSum}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {picked && (
              <p className="mt-1 text-xs text-muted-foreground">
                Pars{teeYards > 0 ? " and distances" : ""} preloaded from {picked.name}. You can
                edit them on the scorecard.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Holes</label>
            <div className="mt-1 grid grid-cols-2 gap-3">
              {[9, 18].map((h) => (
                <button
                  key={h}
                  onClick={() => setHoles(h as 9 | 18)}
                  className={`rounded-lg border-2 p-4 text-center transition-colors ${
                    holes === h
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="text-2xl font-bold">{h}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">holes</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Tees</label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {(["red", "yellow", "white", "blue"] as TeeColor[]).map((c) => {
                const active = tee === c;
                const meta = TEE_META[c];
                const hasData = !!picked?.tees?.[c];
                const yards = picked?.tees?.[c]?.distances?.reduce<number>(
                  (a, b) => a + (b ?? 0),
                  0,
                );
                return (
                  <button
                    key={c}
                    onClick={() => setTee(c)}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-colors ${
                      active
                        ? "border-primary bg-accent"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <span className={`h-5 w-5 rounded-full ${meta.swatch}`} />
                    <span className="text-xs font-semibold">{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {picked ? (hasData && yards ? `${yards} yds` : "—") : "tees"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {TEE_META[tee].description}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {hasCurrentRound ? (
            <p className="text-xs text-muted-foreground">
              Starting a new round will replace your current round.
            </p>
          ) : (
            <span />
          )}
          <Button onClick={handleStart}>Start round</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-[64px] rounded-md bg-muted px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ScorecardTable({
  round,
  updateScore,
  updatePar,
  unit,
}: {
  round: Round;
  updateScore: (i: number, v: string) => void;
  updatePar: (i: number, v: string) => void;
  unit: "yards" | "meters";
}) {
  const groups: number[][] =
    round.holes === 9
      ? [[...Array(9).keys()]]
      : [[...Array(9).keys()], [...Array(9).keys()].map((i) => i + 9)];

  return (
    <div className="space-y-4">
      {groups.map((idxs, gi) => {
        const parSum = idxs.reduce((a, i) => a + (round.pars[i] ?? 0), 0);
        const scoreSum = idxs.reduce((a, i) => a + (round.scores[i] ?? 0), 0);
        const ydsSum = idxs.reduce((a, i) => a + (round.distances[i] ?? 0), 0);
        const label = round.holes === 9 ? "Holes" : gi === 0 ? "Front 9" : "Back 9";
        return (
          <Card key={gi} className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
              <h3 className="text-sm font-semibold">{label}</h3>
              <div className="text-xs text-muted-foreground">
                Par {parSum || "—"} · Score {scoreSum || "—"}
                {ydsSum > 0 && ` · ${convertDistance(ydsSum, unit)} ${unitLabel(unit)}`}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="px-3 py-2 text-left text-xs font-medium">Hole</th>
                    {idxs.map((i) => (
                      <th key={i} className="w-12 px-1 py-2 text-center text-xs font-medium">
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {round.distances.some((d) => d != null) && (
                    <tr className="border-t">
                      <td className="px-3 py-2 text-xs font-medium text-muted-foreground">
                        {unit === "meters" ? "Meters" : "Yards"}
                      </td>
                      {idxs.map((i) => (
                        <td key={i} className="p-1 text-center text-xs tabular-nums text-muted-foreground">
                          {round.distances[i] != null ? convertDistance(round.distances[i]!, unit) : "—"}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr className="border-t">
                    <td className="px-3 py-2 text-xs font-medium text-muted-foreground">Par</td>
                    {idxs.map((i) => (
                      <td key={i} className="p-1">
                        <input
                          inputMode="numeric"
                          value={round.pars[i] ?? ""}
                          onChange={(e) => updatePar(i, e.target.value)}
                          className="h-9 w-full rounded-sm border border-input bg-background text-center text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2 text-xs font-medium">Score</td>
                    {idxs.map((i) => {
                      const s = round.scores[i];
                      const p = round.pars[i];
                      const diff = s != null && p != null ? s - p : null;
                      const tone =
                        diff == null
                          ? ""
                          : diff < 0
                            ? "ring-2 ring-emerald-500/60"
                            : diff === 0
                              ? ""
                              : diff === 1
                                ? "ring-1 ring-amber-500/50"
                                : "ring-2 ring-rose-500/50";
                      return (
                        <td key={i} className="p-1">
                          <input
                            inputMode="numeric"
                            value={s ?? ""}
                            onChange={(e) => updateScore(i, e.target.value)}
                            className={`h-10 w-full rounded-sm border border-input bg-background text-center text-base font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-ring ${tone}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function WidgetTile({
  icon,
  label,
  hint,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group flex flex-col items-start gap-2 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 disabled:opacity-60"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{label}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </button>
  );
}
