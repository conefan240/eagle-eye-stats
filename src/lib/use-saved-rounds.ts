import { useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SAVED_KEY, type Round, type TeeColor } from "@/lib/round-types";

function fromRow(row: any): Round {
  return {
    id: row.id,
    holes: row.holes === 9 ? 9 : 18,
    courseName: row.course_name ?? "",
    tee: (row.tee as TeeColor) ?? "white",
    startedAt: Number(row.started_at) || Date.now(),
    savedAt: row.saved_at != null ? Number(row.saved_at) : undefined,
    pars: Array.isArray(row.pars) ? row.pars : [],
    scores: Array.isArray(row.scores) ? row.scores : [],
    distances: Array.isArray(row.distances) ? row.distances : [],
  };
}

function toRow(r: Round, userId: string) {
  return {
    id: r.id,
    user_id: userId,
    holes: r.holes,
    course_name: r.courseName,
    tee: r.tee,
    started_at: r.startedAt,
    saved_at: r.savedAt ?? null,
    pars: r.pars,
    scores: r.scores,
    distances: r.distances,
  };
}

function loadLocal(): Round[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map((r) => ({
      id: r.id ?? crypto.randomUUID(),
      holes: r.holes === 9 ? 9 : 18,
      courseName: r.courseName ?? "",
      tee: (r.tee as TeeColor) ?? "white",
      startedAt: r.startedAt ?? Date.now(),
      savedAt: r.savedAt,
      pars: Array.isArray(r.pars) ? r.pars : Array(r.holes ?? 18).fill(null),
      scores: Array.isArray(r.scores) ? r.scores : Array(r.holes ?? 18).fill(null),
      distances: Array.isArray(r.distances) ? r.distances : Array(r.holes ?? 18).fill(null),
    }));
  } catch {
    return [];
  }
}

export function useSavedRounds() {
  const [session, setSession] = useState<Session | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [ready, setReady] = useState(false);

  // Track auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load — cloud when signed in, else local. Migrate local → cloud on first sign-in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (session?.user) {
        const local = loadLocal();
        if (local.length > 0) {
          await supabase.from("rounds").upsert(local.map((r) => toRow(r, session.user.id)));
          localStorage.removeItem(SAVED_KEY);
        }
        const { data } = await supabase
          .from("rounds")
          .select("*")
          .order("saved_at", { ascending: false, nullsFirst: false });
        if (!cancelled) setRounds((data ?? []).map(fromRow));
      } else {
        if (!cancelled) setRounds(loadLocal());
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Persist local when not signed in
  useEffect(() => {
    if (!ready) return;
    if (!session?.user) localStorage.setItem(SAVED_KEY, JSON.stringify(rounds));
  }, [rounds, session?.user?.id, ready]);

  const upsert = useCallback(
    async (r: Round) => {
      setRounds((prev) => [r, ...prev.filter((x) => x.id !== r.id)]);
      if (session?.user) {
        await supabase.from("rounds").upsert(toRow(r, session.user.id));
      }
    },
    [session?.user?.id],
  );

  const remove = useCallback(
    async (id: string) => {
      setRounds((prev) => prev.filter((r) => r.id !== id));
      if (session?.user) {
        await supabase.from("rounds").delete().eq("id", id);
      }
    },
    [session?.user?.id],
  );

  return { rounds, upsert, remove, session, ready };
}
