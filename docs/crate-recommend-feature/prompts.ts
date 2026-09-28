// convex/ingestion/prompts.ts
//
// The NER prompt matters. Off-the-shelf NER mangles artist names with
// unusual casing/punctuation (MIKE, billy woods, clipping., $uicideboy$,
// Yaya Bey, JPEGMAFIA, !!!). Claude handles them natively when prompted
// with the right frame.
//
// Output is structured JSON. Parse and validate; reject malformed responses
// rather than try to repair them.

export type NerResult = {
  primary_subject: string;           // the artist the review is about
  mentioned_artists: {
    name: string;                    // as-written in the review
    position: "first_paragraph" | "body" | "closing";
    salience: "central" | "comparison" | "passing" | "list_item";
  }[];
};

export const NER_SYSTEM_PROMPT = `You are extracting musician and band names from a music album review. Rules:

1. Return ONLY valid JSON matching the schema given. No preamble, no prose, no code fences.
2. "primary_subject" is the artist or band the review is ABOUT. If the review covers a group, use the group name. If a solo artist, use their performer name. If the review is a split/compilation, pick the most prominent artist.
3. "mentioned_artists" includes every OTHER musician or band named in the review body — producers, guests, reference points, labelmates, stated influences, artists compared against. Exclude: the primary_subject themselves, venues, record labels, cities, genres, album titles, song titles, critics, journalists, DJs only mentioned as curators, and fictional characters unless they are stage names.
4. Preserve original casing and punctuation exactly as written. "billy woods" stays lowercase. "clipping." keeps the period. "MIKE" stays uppercase.
5. "position" is where in the review the mention first appears: "first_paragraph" for the opening paragraph only, "closing" for the final paragraph, "body" for everything else.
6. "salience":
   - "central" — directly compared to or framed as essential context for the primary subject
   - "comparison" — mentioned as a point of stylistic comparison or contrast
   - "passing" — mentioned once without strong framing
   - "list_item" — one of three or more artists in a list (e.g., "like X, Y, and Z")
7. If an artist is mentioned multiple times, use their highest-salience, earliest-position occurrence.
8. Do not invent artists. If unsure whether a capitalized phrase is an artist name, exclude it.

Output JSON schema:
{
  "primary_subject": string,
  "mentioned_artists": [
    { "name": string, "position": "first_paragraph" | "body" | "closing", "salience": "central" | "comparison" | "passing" | "list_item" }
  ]
}`;

export function buildNerUserMessage(reviewBody: string, titleHint?: string): string {
  const titleLine = titleHint ? `Review title: ${titleHint}\n\n` : "";
  return `${titleLine}Review body:\n\n${reviewBody}`;
}

/**
 * Parse the Haiku response. Returns null on invalid output; caller should
 * decide whether to retry or skip.
 */
export function parseNerResponse(raw: string): NerResult | null {
  // Strip any accidental fences or prose
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) return null;
  const jsonStr = raw.slice(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.primary_subject !== "string") return null;
    if (!Array.isArray(parsed.mentioned_artists)) return null;
    for (const m of parsed.mentioned_artists) {
      if (typeof m.name !== "string") return null;
      if (!["first_paragraph", "body", "closing"].includes(m.position)) return null;
      if (!["central", "comparison", "passing", "list_item"].includes(m.salience)) return null;
    }
    return parsed as NerResult;
  } catch {
    return null;
  }
}

/**
 * Map NER output to an edge weight multiplier used when writing
 * artist_edges. Tune these to taste.
 */
export function edgeWeightFor(
  position: NerResult["mentioned_artists"][0]["position"],
  salience: NerResult["mentioned_artists"][0]["salience"],
): number {
  const positionMultiplier = position === "first_paragraph" ? 1.5 : position === "closing" ? 1.1 : 1.0;
  const salienceBase =
    salience === "central" ? 1.0 :
    salience === "comparison" ? 0.7 :
    salience === "passing" ? 0.4 :
    0.25;   // list_item
  return positionMultiplier * salienceBase;
}
