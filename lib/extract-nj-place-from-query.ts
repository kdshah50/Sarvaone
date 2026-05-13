const PLACE_BLACKLIST = new Set([
  "tomorrow",
  "today",
  "tonight",
  "morning",
  "afternoon",
  "evening",
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]);

function stripOnce(full: string, needle: string): string {
  const idx = full.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return full;
  const out = (full.slice(0, idx) + full.slice(idx + needle.length)).replace(/\s+/g, " ").trim();
  return out.replace(/^[,.\s;-]+/, "").trim();
}

/**
 * Strip leading filler after removing a placename phrase.
 */
function tidySearchAfterPlaceRemoval(full: string): string {
  return full
    .replace(/^\s*(en|in|de|del|la|el|los|las|near|around|for|at|,)\s+/i, "")
    .replace(/^[,.\s;-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heuristically extract `"City"` or `"City, NJ"` / `near City` snippets for NJ geocoding,
 * returning a shorter query for keyword/embed search.
 */
export function extractNjPlaceFromQuery(full: string): { phrase: string; strippedQuery: string } | null {
  const q = full.trim().replace(/\s+/g, " ");
  if (q.length < 3) return null;

  // "Eatontown NJ" / "… Red Bank New Jersey …" (no comma)
  const spaceNj = q.match(/\b([A-Za-z][A-Za-z'\s.-]{2,52})\s+(NJ|New Jersey)\b/i);
  if (spaceNj?.[1]) {
    const phrase = spaceNj[1].trim().replace(/^.*\bin\s+/i, "").trim();
    if (
      phrase.length >= 3 &&
      phrase.length <= 54 &&
      /^[A-Za-z]/.test(phrase) &&
      !/\d/.test(phrase)
    ) {
      const norm = phrase.toLowerCase();
      const firstTok = norm.split(/\s+/)[0] ?? "";
      if (!PLACE_BLACKLIST.has(firstTok)) {
        const stripped = tidySearchAfterPlaceRemoval(stripOnce(q, spaceNj[0]));
        return { phrase, strippedQuery: stripped };
      }
    }
  }

  // "… Edison, NJ …" / "… , New Jersey"
  const commaNj = q.match(/\b([^,!?]{2,52}),\s*(NJ|New Jersey)\b/i);
  if (commaNj?.[1]) {
    let phrase = commaNj[1].trim().replace(/^.*\bin\s+/i, "").trim();
    if (phrase.length >= 3 && /^[A-Za-z]/.test(phrase)) {
      const norm = phrase.toLowerCase();
      const firstTok = norm.split(/\s+/)[0] ?? "";
      if (!PLACE_BLACKLIST.has(firstTok)) {
        let stripped = stripOnce(q, commaNj[0]);
        stripped = tidySearchAfterPlaceRemoval(stripped);
        return phrase.length <= 54 ? { phrase, strippedQuery: stripped } : null;
      }
    }
  }

  // Lone Title-Case township ("Eatontown", "Atlantic City") — do not force "near …"
  const singlePlace = q.match(/^([A-Z][a-z'-]+(?: [A-Z][a-z'-]+){0,2})\s*$/);
  const placeOnly = singlePlace?.[1]?.trim();
  if (placeOnly) {
    const norm = placeOnly.toLowerCase();
    const tokens = norm.split(/\s+/);
    const firstTok = tokens[0] ?? "";
    const nuisanceService = /^(deep|dry|wet|heavy|minor|whole|cleaning|painting|plumbing)$/i.test(
      firstTok,
    );
    if (
      !tokens.some((t) => PLACE_BLACKLIST.has(t)) &&
      !nuisanceService &&
      placeOnly.length >= 3 &&
      placeOnly.length <= 48 &&
      !/\d/.test(placeOnly)
    ) {
      return { phrase: placeOnly, strippedQuery: "" };
    }
  }

  const inNearRe = /\b(?:in|near|around)\s+([A-Za-z][A-Za-z\s'.-]{2,42})\b/;
  const m2 = q.match(inNearRe);
  const rawPlace = m2?.[1]?.trim();
  if (rawPlace) {
    const first = rawPlace.toLowerCase().split(/\s+/)[0] ?? "";
    if (
      /^[A-Za-z]/.test(rawPlace) &&
      !PLACE_BLACKLIST.has(first) &&
      !/^(deep|dry|wet|heavy|minor|whole)$/i.test(first)
    ) {
      const stripped = tidySearchAfterPlaceRemoval(stripOnce(q, m2![0]));
      return rawPlace.length <= 48 ? { phrase: rawPlace, strippedQuery: stripped } : null;
    }
  }

  return null;
}
