import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { suggestCourses, type CourseSuggestion } from "@/lib/suggest-courses.functions";

export type CourseAutocompleteProps = {
  query: string;
  onQueryChange: (query: string) => void;
  picked: CourseSuggestion | null;
  onPick: (suggestion: CourseSuggestion) => void;
  holes: 9 | 18;
  placeholder?: string;
  autoFocus?: boolean;
};

export function CourseAutocomplete({
  query,
  onQueryChange,
  picked,
  onPick,
  holes,
  placeholder = "Start typing a course name…",
  autoFocus,
}: CourseAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

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

  function handlePick(s: CourseSuggestion) {
    onPick(s);
    setSuggestions([]);
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
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
                onClick={() => handlePick(s)}
                className="flex w-full items-center justify-between gap-2 border-t px-3 py-2 text-left text-sm first:border-t-0 hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}</div>
                  {s.location && (
                    <div className="truncate text-xs text-muted-foreground">{s.location}</div>
                  )}
                </div>
                {parSum > 0 && (
                  <div className="text-xs tabular-nums text-muted-foreground">Par {parSum}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
