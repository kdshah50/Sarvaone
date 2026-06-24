/**
 * Regex trade-intent for home services (plumber, HVAC, electrician, handyman).
 * Supplements LLM parse when OPENAI_API_KEY is absent and tightens keywords/extras when present.
 */

import { isBrowseEnabledCategoryId } from "@/lib/marketplace-categories";

export type HomeTradeSlug = "plumbing" | "hvac" | "electrical" | "handyman";

export type HomeTradeRoute = {
  trade: HomeTradeSlug;
  /** Staffing-style label for concierge UI */
  serviceHint: string;
  /** Tighter sparse keyword when the raw query is noisy */
  keywordForSparse: string;
  extraSparseTerms: string[];
  /** When set, UI category chip; search may still scan all service verticals */
  searchCategoryHint?: string;
  /** Search all browse-enabled service verticals (electrician rows often sit under `services`) */
  searchAllServiceVerticals: boolean;
};

type TradeRule = {
  trade: HomeTradeSlug;
  serviceHint: string;
  searchCategoryHint?: string;
  patterns: RegExp[];
  keywords: string[];
  extras: string[];
};

const TRADE_RULES: TradeRule[] = [
  {
    trade: "plumbing",
    serviceHint: "plumbing",
    searchCategoryHint: "handyman",
    patterns: [
      /\b(plumb(er|ing)|plomero|plomer[ií]a)\b/i,
      /\b(water\s+)?leak(ing|s)?\b/i,
      /\b(clogged?|blocked?)\s+(drain|toilet|sink)\b/i,
      /\b(burst|broken)\s+pipe\b/i,
      /\b(sewer|septic|faucet|garbage\s+disposal)\b/i,
      /\b(no\s+hot\s+water|low\s+water\s+pressure)\b/i,
    ],
    keywords: ["plumber", "plumbing"],
    extras: ["plumber", "plumbing", "plomero", "leak", "drain"],
  },
  {
    trade: "hvac",
    serviceHint: "HVAC repair",
    searchCategoryHint: "handyman",
    patterns: [
      /\b(hvac|a\/?c|air\s+condition(er|ing)|furnace|boiler)\b/i,
      /\b(water\s+heater|hot\s+water\s+heater)\b/i,
      /\b(broken|no)\s+(heat|heating|ac|air)\b/i,
      /\b(thermostat|duct|ventilation)\b/i,
      /\b(t[eé]cnico\s+ac|calefacci[oó]n)\b/i,
    ],
    keywords: ["hvac", "water heater"],
    extras: ["hvac", "air conditioning", "furnace", "water heater", "heating", "AC technician"],
  },
  {
    trade: "electrical",
    serviceHint: "electrical repair",
    searchCategoryHint: "handyman",
    patterns: [
      /\b(electric(ian|al|ity)|electricista)\b/i,
      /\b(fuse\s+panel|circuit\s+breaker|breaker\s+panel|panel\s+upgrade)\b/i,
      /\b(flickering\s+lights?|power\s+outage|no\s+power)\b/i,
      /\b(outlet|wiring|rewire|gfci|lighting\s+install)\b/i,
    ],
    keywords: ["electrician", "electrical"],
    extras: ["electrician", "electricista", "electrical", "wiring", "lighting"],
  },
  {
    trade: "handyman",
    serviceHint: "handyman",
    searchCategoryHint: "handyman",
    patterns: [
      /\b(handyman|handy\s*man|general\s+repair)\b/i,
      /\b(ikea\s+assembly|furniture\s+assembly|mount\s+(tv|television))\b/i,
      /\b(drywall|patch\s+hole|door\s+repair|fix\s+door)\b/i,
      /\b(reparaciones|manitas)\b/i,
    ],
    keywords: ["handyman", "repair"],
    extras: ["handyman", "assembly", "repair", "reparaciones"],
  },
];

/** Strip ZIP / “near me” noise so sparse tokens stay trade-focused. */
export function stripGeoNoiseFromTradeQuery(q: string): string {
  return q
    .replace(/\b(near|close\s+to|around)\s+(me|zip|cp|c\.?\s*p\.?)\b/gi, " ")
    .replace(/\b(zip|cp|c\.?\s*p\.?)\s*#?\s*\d{5}(?:-\d{4})?\b/gi, " ")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatchingRule(q: string): TradeRule | null {
  for (const rule of TRADE_RULES) {
    if (rule.patterns.some((re) => re.test(q))) return rule;
  }
  return null;
}

export function detectHomeTradeRoute(rawQuery: string): HomeTradeRoute | null {
  const q = stripGeoNoiseFromTradeQuery(rawQuery.trim());
  if (!q) return null;

  const rule = firstMatchingRule(q);
  if (!rule) return null;

  const catHint =
    rule.searchCategoryHint && isBrowseEnabledCategoryId(rule.searchCategoryHint)
      ? rule.searchCategoryHint
      : undefined;

  return {
    trade: rule.trade,
    serviceHint: rule.serviceHint,
    keywordForSparse: rule.keywords[0] ?? rule.serviceHint,
    extraSparseTerms: rule.extras,
    searchCategoryHint: catHint,
    searchAllServiceVerticals: true,
  };
}

/** Merge trade routing into parsed search filters (regex + LLM path). */
export function applyHomeTradeRouteToParsed<
  T extends {
    keywordForSparse: string;
    extraSparseTerms?: string[];
    searchCategoryHint?: string;
    searchAllServiceVerticals?: boolean;
  },
>(parsed: T, rawQuery: string): T {
  const route = detectHomeTradeRoute(rawQuery);
  if (!route) return parsed;

  const noisy =
    parsed.keywordForSparse.split(/\s+/).length > 8 ||
    parsed.keywordForSparse.length > parsed.keywordForSparse.trim().length * 0.9;

  const mergedExtras = [...new Set([...(parsed.extraSparseTerms ?? []), ...route.extraSparseTerms])].slice(
    0,
    8,
  );

  return {
    ...parsed,
    keywordForSparse: noisy ? route.keywordForSparse : parsed.keywordForSparse || route.keywordForSparse,
    extraSparseTerms: mergedExtras.length ? mergedExtras : parsed.extraSparseTerms,
    searchCategoryHint: parsed.searchCategoryHint ?? route.searchCategoryHint,
    searchAllServiceVerticals: parsed.searchAllServiceVerticals || route.searchAllServiceVerticals,
  };
}
