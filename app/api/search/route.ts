import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleRestHeaders, getSupabaseUrl } from "@/lib/service-rest";
import { embeddedSellerRow } from "@/lib/seller-trust-display";
import { COLONIAS, COLONIA_RADIUS_KM } from "@/lib/colonias";
import { normalizeUsZip5 } from "@/lib/us-zip";
import { inferNjShopperSearchContext } from "@/lib/infer-nj-shopper-search-context";
import {
  listingMatchesPriceFilters,
  mergeLooseSparseInput,
  parseSearchQuery,
  postgrestSparseKeywordClause,
  postgrestSparseKeywordClauseLoose,
  type ParsedQueryFilters,
} from "@/lib/search-query-parse";
import { postgrestActiveListingVerificationFragment } from "@/lib/browse-listings-filters";
import { browseEnabledServiceVerticalIds, isBrowseEnabledCategoryId } from "@/lib/marketplace-categories";
import { cosineSimilarity, parseStoredEmbedding, similarityScore01 } from "@/lib/search-embedding";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

const ABS_THRESHOLD = 0.20;
const REL_FACTOR    = 0.60;

async function embedQuery(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 2000) }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

function geoBoost(km: number) {
  if (km < 2) return 2.0; if (km < 5) return 1.5; if (km < 10) return 1.2; return 1.0;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r, dLng = (lng2 - lng1) * d2r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function rrf(rank: number, k = 60) { return 1 / (k + rank + 1); }

function parsePesosParam(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Slider / URL caps (whole USD) tighten NL-parsed price bounds. */
function mergeUiPriceUsdIntoParsed(
  parsed: ParsedQueryFilters,
  pminUsd?: number,
  pmaxUsd?: number,
): ParsedQueryFilters {
  const out: ParsedQueryFilters = { ...parsed };
  if (pminUsd != null && pminUsd > 0) {
    const c = pminUsd * 100;
    out.minPriceCents = out.minPriceCents != null ? Math.max(out.minPriceCents, c) : c;
  }
  if (pmaxUsd != null && pmaxUsd > 0) {
    const c = pmaxUsd * 100;
    out.maxPriceCents = out.maxPriceCents != null ? Math.min(out.maxPriceCents, c) : c;
  }
  return out;
}

const SELECT_COLS_FULL = "id,title_es,title_en,title_hi,title_gu,price_mxn,category_id,condition,location_city,location_lat,location_lng,shipping_available,negotiable,photo_urls,payment_methods,users!fk_listings_seller(display_name,trust_badge,dl_verified,ein_verified,ine_verified,rfc_verified,phone_verified)";
const SELECT_COLS_BASE = "id,title_es,title_en,title_hi,title_gu,price_mxn,category_id,condition,location_city,location_lat,location_lng,shipping_available,negotiable,photo_urls,users!fk_listings_seller(display_name,trust_badge,dl_verified,ein_verified,ine_verified,rfc_verified,phone_verified)";
const LISTING_CORE_COLS_NO_USER =
  "id,title_es,title_en,title_hi,title_gu,price_mxn,category_id,condition,location_city,location_lat,location_lng,shipping_available,negotiable,photo_urls,payment_methods,embedding";

const SELECT_EMBED_FULL =
  LISTING_CORE_COLS_NO_USER +
  ",users!fk_listings_seller(display_name,trust_badge,dl_verified,ein_verified,ine_verified,rfc_verified,phone_verified)";

const USER_EMBED_SELECT =
  "id,users!fk_listings_seller(display_name,trust_badge,dl_verified,ein_verified,ine_verified,rfc_verified,phone_verified)";

/** Dense / RPC rows often omit `users`; attach seller embed so listing cards can show trust badges. */
async function enrichResultsWithSellerUsers(
  listings: any[],
  supaUrl: string,
  headers: Record<string, string>
) {
  const need = listings.filter((l) => {
    const u = l?.users;
    return !u || (typeof u === "object" && u !== null && !("display_name" in u));
  });
  const ids = [...new Set(need.map((l) => l.id).filter(Boolean))];
  if (!ids.length) return;

  const inList = ids.join(",");
  const url = `${supaUrl}/rest/v1/listings?id=in.(${inList})&select=${encodeURIComponent(USER_EMBED_SELECT)}`;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return;
    const raw = await res.json();
    const rows: any[] = Array.isArray(raw) ? raw : [];
    const byId = new Map(rows.map((r) => [r.id, r.users]));
    for (const l of listings) {
      const u = byId.get(l.id);
      if (u != null) {
        l.users = embeddedSellerRow(u as Record<string, unknown> | Record<string, unknown>[]) ?? u;
      }
    }
  } catch {
    /* non-fatal */
  }
}

function numSim(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function denseThresholdSlice(rows: any[], effective: ParsedQueryFilters): any[] {
  const priced = rows
    .map((row) => {
      const clone = { ...row };
      delete clone.embedding;
      return clone;
    })
    .filter((l: any) => listingMatchesPriceFilters(l.price_mxn, effective));
  if (!priced.length) return [];
  const best = Math.max(...priced.map((l: any) => numSim(l.similarity)));
  const threshold = Math.max(ABS_THRESHOLD, best * REL_FACTOR);
  return priced.filter((l: any) => numSim(l.similarity) >= threshold);
}

function mergeDensePreferHigherSimilarity(primary: any[], secondary: any[]): any[] {
  const map = new Map<string, any>();
  const consider = (row: any) => {
    if (!row?.id) return;
    const cur = map.get(row.id);
    const s = numSim(row.similarity);
    if (!cur || s >= numSim(cur.similarity)) {
      const { embedding: _emb, ...rest } = row;
      map.set(row.id, rest);
    }
  };
  for (const row of primary) consider(row);
  for (const row of secondary) consider(row);
  return [...map.values()];
}

async function denseRowsFromStoredEmbeddingsCosine(
  queryVec: number[],
  verifyFrag: string,
  category: string,
  supaUrl: string,
  hdrs: Record<string, string>,
): Promise<any[]> {
  const prefix =
    `${supaUrl}/rest/v1/listings?${verifyFrag}&category_id=eq.${encodeURIComponent(category)}` +
    "&embedding=not.is.null";
  let res = await fetch(
    `${prefix}&select=${encodeURIComponent(SELECT_EMBED_FULL)}&limit=240`,
    { headers: hdrs, cache: "no-store" },
  );
  if (!res.ok) {
    res = await fetch(
      `${prefix}&select=${encodeURIComponent(LISTING_CORE_COLS_NO_USER)}&limit=240`,
      { headers: hdrs, cache: "no-store" },
    );
  }
  if (!res.ok) return [];
  const raw = await res.json();
  const rows: any[] = Array.isArray(raw) ? raw : [];
  const out: any[] = [];
  for (const row of rows) {
    const embArr = parseStoredEmbedding(row.embedding);
    if (!embArr || embArr.length !== queryVec.length) continue;
    const cosine = cosineSimilarity(queryVec, embArr);
    const sim01 = similarityScore01(cosine);
    const { embedding: _e, ...rest } = row;
    out.push({ ...rest, similarity: sim01 });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const supaUrl = getSupabaseUrl();
  const headers = { ...getServiceRoleRestHeaders(), "Content-Type": "application/json" };
  const { searchParams } = new URL(req.url);
  let query        = (searchParams.get("q") ?? "").trim();
  const browseCategory = searchParams.get("category") ?? "services";
  const coloniaSlugParam = (searchParams.get("colonia") ?? "").trim().toLowerCase();
  const validatedColoniaChip =
    coloniaSlugParam && coloniaSlugParam in COLONIAS && coloniaSlugParam !== "otro"
      ? coloniaSlugParam
      : "";
  let lat        = parseFloat(searchParams.get("lat") ?? "NaN");
  let lng        = parseFloat(searchParams.get("lng") ?? "NaN");
  let hasGeo       = Number.isFinite(lat) && Number.isFinite(lng);
  let geoZipApplied: string | null = normalizeUsZip5(searchParams.get("zip"));
  const pminUsd  = parsePesosParam(searchParams.get("pmin"));
  const pmaxUsd  = parsePesosParam(searchParams.get("pmax"));

  const inferred = await inferNjShopperSearchContext({
    rawQuery: query,
    zipParam: searchParams.get("zip"),
    shopperLat: hasGeo ? lat : null,
    shopperLng: hasGeo ? lng : null,
    lockedColoniaSlug: validatedColoniaChip || null,
  });

  query = inferred.cleanedQuery;
  if (inferred.shopperLat != null && inferred.shopperLng != null) {
    lat = inferred.shopperLat;
    lng = inferred.shopperLng;
    hasGeo = true;
  }
  geoZipApplied = inferred.geoZipApplied ?? geoZipApplied;

  const effectiveColoniaSlug =
    inferred.enrichment !== "none" && inferred.inferredCountySlug
      ? inferred.inferredCountySlug
      : validatedColoniaChip || inferred.inferredCountySlug;
  const coloniaRef =
    effectiveColoniaSlug ? COLONIAS[effectiveColoniaSlug] ?? null : null;

  let sparseRows: any[] = [];
  let denseRows:  any[] = [];
  let denseRpcReturned = 0;
  let denseCosineCandidates = 0;
  let denseRpcHttpOk = false;
  let sparseHttpStatus: number | null = null;
  let sparseKeywordStrategy: "strict" | "loose" | "browse" | "none" = "none";

  let parsed: ParsedQueryFilters = {
    keywordForSparse: query,
    textForEmbedding: query,
    source: "none",
  };
  if (query) {
    parsed = await parseSearchQuery(query, browseCategory);
    if (!parsed.keywordForSparse.trim()) {
      parsed = { ...parsed, keywordForSparse: query };
    }
    if (!parsed.textForEmbedding.trim()) {
      parsed = { ...parsed, textForEmbedding: query };
    }
  }

  const sparsePhrase = parsed.keywordForSparse.trim() || query;
  const embedPhrase = parsed.textForEmbedding.trim() || query;

  const effective = mergeUiPriceUsdIntoParsed(parsed, pminUsd, pmaxUsd);

  const conciergeEffective =
    effective.concierge != null
      ? {
          ...effective.concierge,
          budgetMaxCents: effective.maxPriceCents ?? effective.concierge.budgetMaxCents,
          budgetMinCents: effective.minPriceCents ?? effective.concierge.budgetMinCents,
        }
      : null;

  /** LLM routing from generic Services tab → any browse vertical (Beauty, Electronics, Fitness, …). */
  const searchCategory =
    browseCategory === "services" &&
    effective.searchCategoryHint &&
    isBrowseEnabledCategoryId(effective.searchCategoryHint) &&
    effective.searchCategoryHint !== "services"
      ? effective.searchCategoryHint
      : browseCategory;

  const sparseForLoose = mergeLooseSparseInput(sparsePhrase, effective.extraSparseTerms);

  function appendPriceToUrl(base: string): string {
    let u = base;
    if (effective.maxPriceCents != null) {
      u += `&price_mxn=lte.${effective.maxPriceCents}`;
    }
    if (effective.minPriceCents != null) {
      u += `&price_mxn=gte.${effective.minPriceCents}`;
    }
    return u;
  }

  async function listingRowsFromUrl(baseCompleteUrl: string): Promise<{ rows: any[]; status: number }> {
    let res = await fetch(baseCompleteUrl, { headers, cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return { rows: Array.isArray(data) ? data : [], status: res.status };
    }
    const altUrl = baseCompleteUrl.replace(SELECT_COLS_FULL, SELECT_COLS_BASE);
    res = await fetch(altUrl, { headers, cache: "no-store" });
    const data = res.ok ? await res.json() : [];
    return { rows: Array.isArray(data) ? data : [], status: res.status };
  }

  if (query) {
    // ── Layer 1: Sparse keyword search ──────────────────────────────────────
    try {
      const hasPrice = effective.maxPriceCents != null || effective.minPriceCents != null;
      const keywordTooShort = !sparsePhrase || sparsePhrase.trim().length < 2;
      const verifyFrag = postgrestActiveListingVerificationFragment(searchCategory);
      const sparseKw = postgrestSparseKeywordClause(sparsePhrase);
      const sparseParam =
        sparseKw == null
          ? ""
          : `${sparseKw.dimension}=${encodeURIComponent(sparseKw.clause)}&`;
      const core =
        hasPrice && keywordTooShort
          ? `${supaUrl}/rest/v1/listings?${verifyFrag}&category_id=eq.${searchCategory}&select=${SELECT_COLS_FULL}&order=created_at.desc&limit=24`
          : sparseParam
            ? `${supaUrl}/rest/v1/listings?${verifyFrag}&category_id=eq.${searchCategory}&${sparseParam}select=${SELECT_COLS_FULL}&limit=48`
            : `${supaUrl}/rest/v1/listings?${verifyFrag}&category_id=eq.${searchCategory}&select=${SELECT_COLS_FULL}&order=created_at.desc&limit=20`;
      sparseKeywordStrategy =
        sparseParam.length > 0 ? "strict" : "browse";
      const strictUrl = appendPriceToUrl(core);
      const fetched = await listingRowsFromUrl(strictUrl);
      sparseRows = fetched.rows;
      sparseHttpStatus = fetched.status;
      sparseRows = sparseRows.filter((l) => listingMatchesPriceFilters(l.price_mxn, effective));

      const usedKeywordClause = sparseParam.length > 0;
      const looseKw = postgrestSparseKeywordClauseLoose(sparseForLoose);
      const clauseDiffers =
        looseKw &&
        sparseKw &&
        (looseKw.dimension !== sparseKw.dimension || looseKw.clause !== sparseKw.clause);
      if (usedKeywordClause && sparseRows.length === 0 && fetched.status < 400 && looseKw != null && clauseDiffers) {
        const looseParam = `${looseKw.dimension}=${encodeURIComponent(looseKw.clause)}&`;
        const coreLoose = `${supaUrl}/rest/v1/listings?${verifyFrag}&category_id=eq.${searchCategory}&${looseParam}select=${SELECT_COLS_FULL}&limit=48`;
        const looseFetched = await listingRowsFromUrl(appendPriceToUrl(coreLoose));
        sparseKeywordStrategy = "loose";
        sparseHttpStatus = looseFetched.status;
        sparseRows = looseFetched.rows.filter((l) =>
          listingMatchesPriceFilters(l.price_mxn, effective),
        );
      }
    } catch {}

    // ── Layer 2: Dense semantic — Supabase RPC (if present) + cosine on stored JSONB embeddings ──
    try {
      const vec = await embedQuery(embedPhrase);
      if (vec) {
        const verifyFrag = postgrestActiveListingVerificationFragment(searchCategory);
        let rpcRows: any[] = [];
        const dr = await fetch(`${supaUrl}/rest/v1/rpc/search_listings_dense`, {
          method: "POST",
          headers,
          body: JSON.stringify({ query_embedding: vec, category_filter: searchCategory, match_count: 80 }),
          cache: "no-store",
        });
        denseRpcHttpOk = dr.ok;
        const data = dr.ok ? await dr.json() : [];
        if (Array.isArray(data) && data.length > 0) {
          denseRpcReturned = data.length;
          rpcRows = data.map((row: any) => {
            const { embedding: _e, ...rest } = row;
            return rest;
          });
        }

        const cosineRows = await denseRowsFromStoredEmbeddingsCosine(vec, verifyFrag, searchCategory, supaUrl, headers);
        denseCosineCandidates = cosineRows.length;

        const merged = mergeDensePreferHigherSimilarity(rpcRows, cosineRows);
        denseRows = denseThresholdSlice(merged, effective);
      }
    } catch {}

  } else {
    // No query — return all active services
    try {
      const verifyFrag = postgrestActiveListingVerificationFragment(browseCategory);
      let baseUrl = `${supaUrl}/rest/v1/listings?${verifyFrag}&category_id=eq.${browseCategory}&select=${SELECT_COLS_FULL}&order=created_at.desc&limit=24`;
      baseUrl = appendPriceToUrl(baseUrl);
      sparseKeywordStrategy = "browse";
      const browsed = await listingRowsFromUrl(baseUrl);
      sparseRows = browsed.rows;
      sparseHttpStatus = browsed.status;
      sparseRows = sparseRows.filter((l) => listingMatchesPriceFilters(l.price_mxn, effective));
    } catch {}
  }

  // ── RRF fusion + geo boost ─────────────────────────────────────────────────
  type Entry = { listing: any; sparse: number; dense: number; geo: number };
  const map = new Map<string, Entry>();

  sparseRows.forEach((l, i) => map.set(l.id, { listing: l, sparse: rrf(i), dense: 0, geo: 1 }));
  denseRows.forEach((l, i) => {
    const e = map.get(l.id);
    if (e) e.dense = rrf(i);
    else map.set(l.id, { listing: l, sparse: 0, dense: rrf(i), geo: 1 });
  });

  if (hasGeo) {
    map.forEach(e => {
      const { location_lat: lt, location_lng: ln } = e.listing;
      if (lt && ln) {
        const km = haversineKm(lat, lng, lt, ln);
        e.listing._dist_km = Math.round(km * 10) / 10;
        e.geo = geoBoost(km);
      }
    });
  }

  let fused = Array.from(map.values())
    .map(({ listing, sparse, dense, geo }) => ({
      ...listing,
      _score: Math.round((sparse * 0.4 + dense * 0.4) * geo * 10000) / 10000,
      _mode: dense > 0 && sparse > 0 ? "hybrid" : dense > 0 ? "dense" : "sparse",
    }));

  if (coloniaRef) {
    fused = fused.filter((l) => {
      const lt = l.location_lat;
      const ln = l.location_lng;
      if (!lt || !ln) return false;
      return haversineKm(coloniaRef.lat, coloniaRef.lng, lt, ln) <= COLONIA_RADIUS_KM;
    });
  }

  fused = fused.filter((l) => listingMatchesPriceFilters(l.price_mxn, effective));

  let results = fused
    .sort((a, b) => b._score - a._score)
    .slice(0, 24);

  let browseFallbackUsed = false;
  /** Last resort when keyword + semantic still find nothing verified in category (bad recall or missing embeddings). */
  if (!results.length && query.trim()) {
    try {
      const fallbackVerifyFrag = postgrestActiveListingVerificationFragment("services");
      const svcVerticals = browseEnabledServiceVerticalIds();
      const useWideCategories =
        searchCategory === "services" && svcVerticals.length > 0;
      const categoryFilter = useWideCategories
        ? `category_id=in.(${svcVerticals.map((id) => encodeURIComponent(id)).join(",")})`
        : `category_id=eq.${encodeURIComponent(searchCategory)}`;

      /** When the shopper is on generic Services, widen `category_id` and retry ILIKE keywords first so Handyman/etc. titles match. */
      const fbKw = postgrestSparseKeywordClause(sparsePhrase);
      let fbKwParam =
        fbKw == null ? "" : `${fbKw.dimension}=${encodeURIComponent(fbKw.clause)}&`;

      let fbRows: any[] = [];
      if (useWideCategories && fbKwParam.length > 0) {
        const kwUrl =
          `${supaUrl}/rest/v1/listings?${fallbackVerifyFrag}&${categoryFilter}&${fbKwParam}` +
          `select=${SELECT_COLS_FULL}&limit=48`;
        const kwFetched = await listingRowsFromUrl(appendPriceToUrl(kwUrl));
        fbRows = kwFetched.rows.filter((l) =>
          listingMatchesPriceFilters(l.price_mxn, effective),
        );
      }

      if (!fbRows.length) {
        let fbUrl =
          `${supaUrl}/rest/v1/listings?${fallbackVerifyFrag}&${categoryFilter}` +
          `&select=${SELECT_COLS_FULL}&order=created_at.desc&limit=48`;
        fbUrl = appendPriceToUrl(fbUrl);
        const fetched = await listingRowsFromUrl(fbUrl);
        fbRows = fetched.rows.filter((l) =>
          listingMatchesPriceFilters(l.price_mxn, effective),
        );
      }

      if (coloniaRef) {
        fbRows = fbRows.filter((l: any) => {
          const lt = l.location_lat;
          const ln = l.location_lng;
          if (!lt || !ln) return false;
          return haversineKm(coloniaRef.lat, coloniaRef.lng, lt, ln) <= COLONIA_RADIUS_KM;
        });
      }

      if (fbRows.length) {
        browseFallbackUsed = true;
        if (hasGeo) {
          fbRows = fbRows
            .map((l: any) => {
              const lt = l.location_lat;
              const ln = l.location_lng;
              if (!lt || !ln) return l;
              const km = haversineKm(lat, lng, lt, ln);
              return { ...l, _dist_km: Math.round(km * 10) / 10 };
            })
            .sort(
              (a: any, b: any) =>
                (Number(a._dist_km) || 9999) - (Number(b._dist_km) || 9999),
            );
        }
        results = fbRows.slice(0, 24).map((listing: any) => ({
          ...listing,
          _score: 0,
          _mode: "browse_fallback",
        }));
      }
    } catch {
      /* keep empty */
    }
  }

  await enrichResultsWithSellerUsers(results, supaUrl, headers);

  const mode = browseFallbackUsed
    ? "browse_fallback"
    : denseRows.length > 0 && sparseRows.length > 0
      ? "hybrid"
      : denseRows.length > 0
        ? "dense"
        : sparseRows.length > 0
          ? "sparse"
          : "empty";
  const debug = {
    hasOpenAIKey: !!OPENAI_KEY,
    browseFallbackUsed,
    sparseHttpStatus,
    sparseKeywordStrategy,
    sparseCount: sparseRows.length,
    denseCount: denseRows.length,
    denseRpcHttpOk,
    denseRpcReturned,
    denseCosineCandidates,
    parse: {
      source: parsed.source,
      browseCategory,
      searchCategoryUsed: searchCategory,
      searchCategoryHint: effective.searchCategoryHint ?? null,
      extraSparseTerms: effective.extraSparseTerms ?? null,
      keywordForSparse: sparsePhrase,
      textForEmbedding: embedPhrase,
      maxPriceCents: effective.maxPriceCents ?? null,
      minPriceCents: effective.minPriceCents ?? null,
      concierge: conciergeEffective,
      pminUsd: pminUsd ?? null,
      pmaxUsd: pmaxUsd ?? null,
      zipUsedForGeo: geoZipApplied ?? null,
    },
    njLocationInference: {
      enrichment: inferred.enrichment,
      inferredCountySlug: inferred.inferredCountySlug || null,
      validatedColoniaChip: validatedColoniaChip || null,
      effectiveCountySlug: effectiveColoniaSlug || null,
    },
  };

  return NextResponse.json({
    results, mode, query, total: results.length, debug,
    colonia: coloniaRef
      ? { key: effectiveColoniaSlug, label: coloniaRef.label }
      : null,
  });
}
