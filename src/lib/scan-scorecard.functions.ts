import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  imageDataUrl: z.string().min(20),
  holes: z.union([z.literal(9), z.literal(18)]),
  playerName: z.string().trim().max(120).optional(),
});

export type ScanResult = {
  scores: (number | null)[];
  pars?: (number | null)[];
  courseName?: string | null;
  matchedPlayer?: string | null;
  matchNote?: string | null;
};

export const scanScorecard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<ScanResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const name = (data.playerName ?? "").trim();

    const sys = name
      ? `You are an expert at reading golf scorecards from photos. Scorecards typically list several players in separate columns (or rows). The user's saved name is "${name}". Find the column or row whose header/label matches that name — accept close matches: first name only, common nicknames, initials, or minor OCR misspellings. Pull the stroke scores ONLY from that matched player's column/row. If the card has no player labels at all, fall back to the leftmost/most prominent player column. Return strict JSON only.`
      : `You are an expert at reading golf scorecards from photos. Extract the player's stroke scores for each hole. If multiple players appear, pick the leftmost or most prominent player column/row. Return strict JSON only.`;

    const userText = `Extract scores for ${data.holes} holes${name ? ` for player "${name}"` : ""}. Respond with JSON: {"courseName": string|null, "pars": number[] (length ${data.holes}, use null if unknown), "scores": number[] (length ${data.holes}, use null for blanks), "matchedPlayer": string|null (the exact player label you pulled scores from, or null if the card had no player names), "matchNote": string|null (short reason, e.g. "matched 'Colm' to saved name Colm Fanning" or "no player labels — used leftmost column")}. No prose, no markdown.`;

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
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

    const normalize = (arr: any): (number | null)[] => {
      const out: (number | null)[] = [];
      for (let i = 0; i < data.holes; i++) {
        const v = Array.isArray(arr) ? arr[i] : null;
        const n = typeof v === "number" ? v : v == null ? null : Number(v);
        out.push(Number.isFinite(n) ? (n as number) : null);
      }
      return out;
    };

    return {
      courseName: parsed.courseName ?? null,
      pars: normalize(parsed.pars),
      scores: normalize(parsed.scores),
      matchedPlayer: typeof parsed.matchedPlayer === "string" ? parsed.matchedPlayer : null,
      matchNote: typeof parsed.matchNote === "string" ? parsed.matchNote : null,
    };
  });
