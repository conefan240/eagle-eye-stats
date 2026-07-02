import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  query: z.string().min(1).max(120),
  holes: z.union([z.literal(9), z.literal(18)]),
});

export type TeeColor = "red" | "white" | "yellow" | "blue";

export type TeeData = {
  pars: (number | null)[];
  distances: (number | null)[]; // yards per hole
};

export type CourseSuggestion = {
  name: string;
  location?: string | null;
  pars: (number | null)[]; // default/white-tee pars
  tees: Partial<Record<TeeColor, TeeData>>;
};

export const suggestCourses = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ suggestions: CourseSuggestion[] }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const sys = `You are a golf course database assistant with deep knowledge of real courses worldwide. Given a partial course name, return up to 6 real, well-known golf courses that match. For every course you MUST fill in par AND yardage for EVERY hole and EVERY tee (red, white, yellow, blue). If you don't know exact values for a specific tee, provide your best plausible estimate consistent with the course's overall length and layout — DO NOT use null. Only leave a tee out entirely if the course genuinely does not have that tee color. Respond with strict JSON only.`;

    const userText = `Partial course name: "${data.query}"
Return JSON of the form:
{
  "suggestions": [
    {
      "name": string,
      "location": string|null,
      "tees": {
        "red":    { "pars": number[${data.holes}], "distances": number[${data.holes}] },
        "white":  { "pars": number[${data.holes}], "distances": number[${data.holes}] },
        "yellow": { "pars": number[${data.holes}], "distances": number[${data.holes}] },
        "blue":   { "pars": number[${data.holes}], "distances": number[${data.holes}] }
      }
    }
  ]
}
Rules:
- All ${data.holes} pars must be filled with integers 3-5 (occasionally 6 for very long par-6s).
- All ${data.holes} distances must be filled with realistic yardages (par 3: 100-260, par 4: 280-500, par 5: 470-650). Never null, never 0.
- Pars are usually identical across tees; distances vary: red = shortest, yellow ≈ short-mid, white = regular, blue = back/longest. Red is always shorter than blue on every hole.
- Total yardage should roughly match the course's known length for that tee.
- If you cannot find a real matching course, return {"suggestions": []}. Do NOT invent fictional courses.
- No prose, no markdown.`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userText },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in your workspace billing settings.");
      throw new Error(`AI gateway error ${res.status}: ${txt.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const normPar = (v: any): number | null => {
      const n = typeof v === "number" ? v : v == null ? null : Number(v);
      return n != null && Number.isFinite(n) && n >= 3 && n <= 6 ? n : null;
    };
    const normDist = (v: any): number | null => {
      const n = typeof v === "number" ? v : v == null ? null : Number(v);
      return n != null && Number.isFinite(n) && n >= 40 && n <= 900 ? Math.round(n) : null;
    };

    const rawList: any[] = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    const suggestions: CourseSuggestion[] = rawList.slice(0, 6).map((s) => {
      const teesRaw = s?.tees ?? {};
      const tees: Partial<Record<TeeColor, TeeData>> = {};
      const colors: TeeColor[] = ["red", "white", "yellow", "blue"];
      for (const c of colors) {
        const t = teesRaw[c];
        if (!t) continue;
        const pars: (number | null)[] = [];
        const distances: (number | null)[] = [];
        for (let i = 0; i < data.holes; i++) {
          pars.push(normPar(Array.isArray(t.pars) ? t.pars[i] : null));
          distances.push(normDist(Array.isArray(t.distances) ? t.distances[i] : null));
        }
        tees[c] = { pars, distances };
      }
      // Fallback default pars: prefer white, then any available tee
      const defaultPars =
        tees.white?.pars ??
        tees.blue?.pars ??
        tees.yellow?.pars ??
        tees.red?.pars ??
        Array(data.holes).fill(null);

      return {
        name: String(s?.name ?? "").slice(0, 120),
        location: s?.location ? String(s.location).slice(0, 120) : null,
        pars: defaultPars,
        tees,
      };
    }).filter((s) => s.name.length > 0);

    return { suggestions };
  });
