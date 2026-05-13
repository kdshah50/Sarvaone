/**
 * Turn free-text search (EN/ES) into structured hints: price caps/floors + cleaner keyword/embedding strings.
 * Used by /api/search — LLM when OPENAI_API_KEY is set, else regex heuristics.
 *
 * Prices are **USD**: whole dollars in NLP output, stored/filtered as **USD cents** (same as `listings.price_mxn`).
 */

import { isBrowseEnabledCategoryId } from "@/lib/marketplace-categories";
import type { ConciergeRequest, LlmConciergeFields } from "@/lib/concierge-intent";
import {
  conciergeFromLlmFields,
  finalizeConciergeRequest,
  regexExtractConciergeHints,
} from "@/lib/concierge-intent";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const CHAT_MODEL = process.env.SEARCH_PARSE_MODEL ?? "gpt-4o-mini";

export type ParsedQueryFilters = {
  maxPriceCents?: number;
  minPriceCents?: number;
  /** Short phrase for title ilike (no price junk). */
  keywordForSparse: string;
  /** Fuller line for embedding similarity. */
  textForEmbedding: string;
  source: "llm" | "regex" | "none";
  /**
   * When the shopper is on generic "services", narrow to another browse vertical (service or goods)
   * so listings in that category are included (yoga→fitness, buy phone→electronics).
   */
  searchCategoryHint?: string;
  /** Optional synonym snippets sellers use; broadens loose ILIKE recall. */
  extraSparseTerms?: string[];
  /** Structured concierge slot for future booking pipeline; search ignores except debug / separate routes. */
  concierge?: ConciergeRequest;
};

function wholeUsdToCents(wholeUsd: number): number {
  if (!Number.isFinite(wholeUsd) || wholeUsd < 0) return 0;
  return Math.round(wholeUsd * 100);
}

function parseNumber(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Drops chatty wrappers so sparse search aligns with listing-style titles (“Deep clean Edison” vs “I'm looking for…”).
 */
function stripConversationalFiller(s: string): string {
  let t = s.trim().replace(/\s+/g, " ");
  const leadPatterns: RegExp[] = [
    /^(i['']?m|i am)\s+(looking|searching|trying)\s+(for|to find)\s+/i,
    /^(i\s+)?need\s+(someone\s+to\s+|help\s+|a\s+|an\s+)?/i,
    /^(i\s+)?want\s+(to\s+(hire|get|buy)\s+|someone\s+to\s+)?/i,
    /^looking\s+(for|to)\s+/i,
    /^trying\s+to\s+find\s+/i,
    /^(please|pls)\s*(,)?\s*(help\s+(me\s+)?)?(find|with)\s+/i,
    /^show\s+me\s+/i,
    /^find\s+me\s+/i,
    /^(can|could|would)\s+(you\s+|some(one|body)|any(one|body))\s+(please\s+)?/i,
    /^does\s+any(one|body)\s+know\s+/i,
    /^hoping\s+(to\s+find|someone)\s+/i,
    /^someone\s+to\s+/i,
    /^busco\s+/i,
    /^necesito\s+(algo\s+|alguien\s+)?/i,
    /^quiero\s+(contratar|encontrar|alguien|una|un)\s+/i,
    /^por\s+favor\s+/i,
  ];
  let guard = 0;
  while (guard++ < 12) {
    const before = t;
    for (const re of leadPatterns) {
      const next = t.replace(re, "").trim().replace(/\s+/g, " ");
      if (next !== t) t = next;
    }
    if (t === before) break;
  }
  t = t.replace(/\s+(thanks|thank\s+you|thx)\.?$/i, "").trim();
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Regex extraction: "under $50", "less than 200 dollars", "max 900", "hasta 100".
 * Strips matched segments from the query for keyword search.
 * All monetary amounts are treated as **USD** (whole dollars) for this US marketplace.
 */
export function regexParseSearchQuery(input: string): ParsedQueryFilters {
  let rest = input.trim();
  let maxUsd: number | undefined;
  let minUsd: number | undefined;

  const priceClause =
    /\b(under|below|less\s+than|menos\s+de|hasta|máximo|maximo|max|at\s+most|por\s+menos\s+de)\s*\$?\s*([\d,.]+)\s*(usd|us\s*\$|dollars?|dlls?|mxn|mx\$|pesos?)?\b/gi;
  const priceClauseMin =
    /\b(over|above|more\s+than|más\s+de|al\s+menos|min|minimum|at\s+least|desde)\s*\$?\s*([\d,.]+)\s*(usd|us\s*\$|dollars?|dlls?|mxn|mx\$|pesos?)?\b/gi;
  const priceLessNumber = /\b<\s*\$?\s*([\d,.]+)\s*(usd|mxn|pesos?)?\b/gi;

  const applyMax = (amount: number) => {
    if (!Number.isFinite(amount)) return;
    maxUsd = maxUsd === undefined ? amount : Math.min(maxUsd, amount);
  };

  const applyMin = (amount: number) => {
    if (!Number.isFinite(amount)) return;
    minUsd = minUsd === undefined ? amount : Math.max(minUsd, amount);
  };

  rest = rest.replace(priceClause, (_, _op, num) => {
    const amount = parseNumber(num);
    if (!Number.isNaN(amount)) applyMax(amount);
    return " ";
  });
  rest = rest.replace(priceClauseMin, (_, _op, num) => {
    const amount = parseNumber(num);
    if (!Number.isNaN(amount)) applyMin(amount);
    return " ";
  });
  rest = rest.replace(priceLessNumber, (_, num) => {
    const amount = parseNumber(num);
    if (!Number.isNaN(amount)) applyMax(amount);
    return " ";
  });

  rest = stripConversationalFiller(rest.replace(/\s+/g, " ").trim());

  const keywordForSparse =
    rest.replace(/\s+/g, " ").trim() ||
    stripConversationalFiller(input.trim()) ||
    input.trim();
  const textForEmbedding = keywordForSparse.trim() ? keywordForSparse.trim() : input.trim();

  const out: ParsedQueryFilters = {
    keywordForSparse,
    textForEmbedding,
    source: maxUsd !== undefined || minUsd !== undefined ? "regex" : "none",
  };
  if (maxUsd !== undefined) out.maxPriceCents = wholeUsdToCents(maxUsd);
  if (minUsd !== undefined) out.minPriceCents = wholeUsdToCents(minUsd);
  return out;
}

type LlmExtract = LlmConciergeFields & {
  keyword_phrase?: string | null;
  semantic_query?: string | null;
  max_price_usd?: number | null;
  min_price_usd?: number | null;
  /** Alternate words/phrases likely in titles (trainer→instructor, clases yoga, …). Max ~6 short strings. */
  extra_sparse_terms?: string[] | null;
  /**
   * ONE browse vertical (service or product) when intent is clearly a single category:
   * fitness, beauty, tutoring, electronics, vehicles, … — never invent ids beyond marketplace tabs.
   */
  listing_category_hint?: string | null;
};

function normalizeExtraSparseTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim().replace(/\s+/g, " ");
    if (t.length < 2 || t.length > 48) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 6) break;
  }
  return out;
}

/** Valid browse `category_id` when narrowing off generic "services"; rejects unknown slugs and "services". */
function normalizeListingCategoryHint(raw: unknown): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  const s = raw.trim().toLowerCase();
  if (!s || s === "services") return undefined;
  if (!isBrowseEnabledCategoryId(s)) return undefined;
  return s;
}

async function llmParseSearchQuery(
  query: string,
  category: string,
): Promise<{ filters: ParsedQueryFilters; concierge?: LlmConciergeFields } | null> {
  if (!OPENAI_KEY || !query.trim()) return null;

  const system = `You extract search filters for a US local marketplace (bilingual English/Spanish listings).
Return ONLY valid JSON with keys:
- keyword_phrase: **compact** nouns/products/services sellers would put in titles (max ~10 words). Users write long sentences—infer the core listing topic. Strip chit-chat: "I'm looking for", "I need", "can anyone", "please help me find". Example: "Can someone deep clean my apartment Saturday in Edison under ninety bucks?" → "deep cleaning apartment Edison".
- semantic_query: one natural sentence for vector search ONLY about service/item/intent — **omit** price caps like "under $200" unless the numeric budget is central to semantics.
- max_price_usd: maximum price in whole US dollars (integer), or null if not stated.
- min_price_usd: minimum price in whole US dollars (integer), or null if not stated.
- extra_sparse_terms: optional array (max 6) of short EN/ES phrases sellers often use in titles instead of the user's exact words (e.g. "personal yoga trainer" → ["yoga instructor","personal training","clases yoga","entrenador personal"]). Empty array or omit if unnecessary.
- listing_category_hint: optional single browse category id when intent matches ONE vertical. **Services:** fitness (yoga, trainer, pilates), tutoring, beauty, childcare, pet_care, handyman, landscaping. **Goods:** electronics (phones, laptops), vehicles, fashion, home (furniture), sports, realestate. Use null when unclear or mixed intent; use "services" only for generic local help with no clearer vertical.
- concierge_service_hint: optional staffing-style label ("house cleaning", …), or null — same intent as keyword but for booking.
- concierge_time_hint: optional short phrase as user said for timing ("this Saturday", "Saturday morning"), or null.
- preferred_weekday: lowercase monday|tuesday|…|sunday only if a single weekday is clear (e.g. "this Saturday" → saturday), else null.

Rules:
- All prices are US dollars. "Under $50" or "under 50 dollars" → max_price_usd = 50.
- "Under 500 pesos" in a US context still treat as dollars if no conversion is explicit (use 500).
- Ignore availability words like "today", "now", "urgent" for price (leave price null unless a number is given).
- Prose-heavy questions ("who does…?", "what's…?") — still distill keyword_phrase to searchable item plus place if stated.
- Browse tab hint (what the user picked in the UI; do not contradict obvious product intent): ${category}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: query.slice(0, 2000) },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") return null;

    let parsed: LlmExtract;
    try {
      parsed = JSON.parse(raw) as LlmExtract;
    } catch {
      return null;
    }

    const keyword =
      typeof parsed.keyword_phrase === "string" && parsed.keyword_phrase.trim()
        ? parsed.keyword_phrase.trim()
        : query.trim();
    const semantic =
      typeof parsed.semantic_query === "string" && parsed.semantic_query.trim()
        ? parsed.semantic_query.trim()
        : query.trim();

    const out: ParsedQueryFilters = {
      keywordForSparse: keyword,
      textForEmbedding: semantic,
      source: "llm",
    };

    if (parsed.max_price_usd != null && Number.isFinite(Number(parsed.max_price_usd))) {
      out.maxPriceCents = wholeUsdToCents(Math.floor(Number(parsed.max_price_usd)));
    }
    if (parsed.min_price_usd != null && Number.isFinite(Number(parsed.min_price_usd))) {
      out.minPriceCents = wholeUsdToCents(Math.ceil(Number(parsed.min_price_usd)));
    }

    const extras = normalizeExtraSparseTerms(parsed.extra_sparse_terms);
    if (extras.length) out.extraSparseTerms = extras;
    const catHint = normalizeListingCategoryHint(parsed.listing_category_hint);
    if (catHint) out.searchCategoryHint = catHint;

    const concierge: LlmConciergeFields | undefined =
      parsed.concierge_service_hint != null ||
      parsed.concierge_time_hint != null ||
      parsed.preferred_weekday != null
        ? {
            concierge_service_hint: parsed.concierge_service_hint,
            concierge_time_hint: parsed.concierge_time_hint,
            preferred_weekday: parsed.preferred_weekday,
          }
        : undefined;

    return { filters: out, concierge };
  } catch {
    return null;
  }
}

/** Stopwords stripped from sparse search tokens (Spanish + English). */
const SPARSE_TOKEN_STOPWORDS = new Set([
  "the", "and", "with", "for", "from", "that", "this", "are", "your", "you", "not", "per", "any",
  "need", "want", "looking",
  "someone", "anyone", "anybody", "help", "kindly", "please",
  "los", "las", "unos", "unas", "por", "con", "que", "una", "del", "al", "como",
]);

/**
 * 3-letter tokens excluded from ILIKE — `*fan*` matches unintended substrings (`infant`, `infantil`, …).
 * Use “ceiling fan”, Spanish “ventilador”, etc.; semantic search still uses the full phrase.
 */
const SPARSE_ILIKE_TRAP_TOKENS = new Set(["fan"]);

function escIlike(fragment: string): string {
  return `*${fragment.replace(/\\/g, "").replace(/\*/g, "").trim()}*`;
}

const SPARSE_TEXT_FIELDS = [
  "title_es",
  "title_en",
  "title_hi",
  "title_gu",
  "description_es",
  "description_en",
  "description_hi",
  "description_gu",
] as const;

/** One OR branch per (token × field) for PostgREST `or=(...)` — any token match counts. */
function sparseOrBranchesForTokens(unique: string[]): string[] {
  const branches: string[] = [];
  for (const tok of unique) {
    const pat = escIlike(tok);
    for (const f of SPARSE_TEXT_FIELDS) {
      branches.push(`${f}.ilike.${pat}`);
    }
  }
  return branches;
}

/**
 * PostgREST clause for multilingual sparse search.
 * Multi-token phrases use **OR across tokens** (any significant word can match), so natural
 * language like “flickering lights” still finds “electrician … lighting” without needing
 * every token in one row. Dense/hybrid embeddings still refine ranking when available.
 */
export function postgrestSparseKeywordClause(sparsePhrase: string): {
  dimension: "or" | "and";
  clause: string;
} | null {
  const trimmed = sparsePhrase.trim();
  if (!trimmed || trimmed.length < 2) return null;

  const tokens = trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-záéíóúüñ0-9-]/gi, ""))
    .filter(
      (t) =>
        t.length >= 3 &&
        !SPARSE_TOKEN_STOPWORDS.has(t) &&
        !(t.length <= 4 && SPARSE_ILIKE_TRAP_TOKENS.has(t)),
    );
  const unique = [...new Set(tokens)].slice(0, 8);

  if (unique.length === 0) {
    const safe = trimmed.replace(/[*%,()]/g, "").trim();
    if (!safe) return null;
    const oneWord = safe.toLowerCase().split(/\s+/).filter(Boolean);
    if (
      oneWord.length === 1 &&
      oneWord[0].length <= 4 &&
      SPARSE_ILIKE_TRAP_TOKENS.has(oneWord[0])
    ) {
      return null;
    }
    const pat = escIlike(safe);
    const tuple = SPARSE_TEXT_FIELDS.map((f) => `${f}.ilike.${pat}`).join(",");
    return { dimension: "or", clause: `(${tuple})` };
  }

  if (unique.length === 1) {
    const pat = escIlike(unique[0]);
    const tuple = SPARSE_TEXT_FIELDS.map((f) => `${f}.ilike.${pat}`).join(",");
    return { dimension: "or", clause: `(${tuple})` };
  }

  const branches = sparseOrBranchesForTokens(unique);
  return { dimension: "or", clause: `(${branches.join(",")})` };
}

/**
 * Loose recall: same OR-across-tokens shape as strict when tokens exist; kept for callers that
 * retry with extra synonym terms merged into the phrase.
 */
export function postgrestSparseKeywordClauseLoose(sparsePhrase: string): {
  dimension: "or";
  clause: string;
} | null {
  const trimmed = sparsePhrase.trim();
  if (!trimmed || trimmed.length < 2) return null;

  const tokens = trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-záéíóúüñ0-9-]/gi, ""))
    .filter(
      (t) =>
        t.length >= 3 &&
        !SPARSE_TOKEN_STOPWORDS.has(t) &&
        !(t.length <= 4 && SPARSE_ILIKE_TRAP_TOKENS.has(t)),
    );
  const unique = [...new Set(tokens)].slice(0, 8);

  const branches: string[] = [];
  if (unique.length === 0) {
    const safe = trimmed.replace(/[*%,()]/g, "").trim();
    if (!safe) return null;
    const oneWord = safe.toLowerCase().split(/\s+/).filter(Boolean);
    if (
      oneWord.length === 1 &&
      oneWord[0].length <= 4 &&
      SPARSE_ILIKE_TRAP_TOKENS.has(oneWord[0])
    ) {
      return null;
    }
    const pat = escIlike(safe);
    for (const f of SPARSE_TEXT_FIELDS) branches.push(`${f}.ilike.${pat}`);
  } else {
    branches.push(...sparseOrBranchesForTokens(unique));
  }
  if (branches.length === 0) return null;
  return { dimension: "or", clause: `(${branches.join(",")})` };
}

/** Concatenate sparse keyword phrase with LLM synonym snippets for broader loose ILIKE. */
export function mergeLooseSparseInput(keywordForSparse: string, extras?: string[]): string {
  const base = keywordForSparse.trim();
  if (!extras?.length) return base;
  const tail = extras.map((x) => String(x).trim()).filter(Boolean);
  return [base, ...tail].join(" ").replace(/\s+/g, " ").trim();
}

/** Merge LLM + regex: regex can fill price if LLM omitted; prefer LLM keyword/semantic when present. */
export async function parseSearchQuery(query: string, category: string): Promise<ParsedQueryFilters> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { keywordForSparse: "", textForEmbedding: "", source: "none" };
  }

  const rx = regexParseSearchQuery(trimmed);
  const regexConciergeHints = regexExtractConciergeHints(trimmed);
  const llmResult = await llmParseSearchQuery(trimmed, category);

  if (!llmResult) {
    const concierge = finalizeConciergeRequest(
      undefined,
      regexConciergeHints,
      rx.maxPriceCents,
      rx.minPriceCents,
    );
    if (rx.source === "none") {
      const lite = stripConversationalFiller(trimmed);
      return {
        ...rx,
        keywordForSparse: lite || trimmed,
        textForEmbedding: lite || trimmed,
        ...(concierge ? { concierge } : {}),
      };
    }
    return { ...rx, ...(concierge ? { concierge } : {}) };
  }

  const { filters: llm, concierge: llmConciergeFields } = llmResult;

  // If model echoed a long conversational line, tighten with the same heuristic as regex-only users.
  const llmKw = llm.keywordForSparse?.trim();
  const cleanedFallback =
    llmKw && (llmKw.length > trimmed.length * 0.85 || llmKw.split(/\s+/).length > 12)
      ? stripConversationalFiller(llmKw)
      : null;

  const merged: ParsedQueryFilters = {
    keywordForSparse: ((cleanedFallback ?? llm.keywordForSparse) || "").trim() || trimmed,
    textForEmbedding: llm.textForEmbedding || trimmed,
    source: "llm",
    maxPriceCents: llm.maxPriceCents ?? rx.maxPriceCents,
    minPriceCents: llm.minPriceCents ?? rx.minPriceCents,
    searchCategoryHint: llm.searchCategoryHint,
    extraSparseTerms: llm.extraSparseTerms,
  };

  if (merged.maxPriceCents != null && rx.maxPriceCents != null) {
    merged.maxPriceCents = Math.min(merged.maxPriceCents, rx.maxPriceCents);
  }
  if (merged.minPriceCents != null && rx.minPriceCents != null) {
    merged.minPriceCents = Math.max(merged.minPriceCents, rx.minPriceCents);
  }
  if (merged.maxPriceCents == null) merged.maxPriceCents = rx.maxPriceCents;
  if (merged.minPriceCents == null) merged.minPriceCents = rx.minPriceCents;

  const fromLlm =
    llmConciergeFields != null ? conciergeFromLlmFields(llmConciergeFields) : undefined;
  const concierge = finalizeConciergeRequest(
    fromLlm,
    regexConciergeHints,
    merged.maxPriceCents,
    merged.minPriceCents,
  );
  if (concierge) merged.concierge = concierge;

  return merged;
}

export function listingMatchesPriceFilters(
  priceCents: number | null | undefined,
  f: Pick<ParsedQueryFilters, "maxPriceCents" | "minPriceCents">
): boolean {
  if (priceCents == null || !Number.isFinite(Number(priceCents))) return true;
  const p = Number(priceCents);
  if (f.maxPriceCents != null && p > f.maxPriceCents) return false;
  if (f.minPriceCents != null && p < f.minPriceCents) return false;
  return true;
}
