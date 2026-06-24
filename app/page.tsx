import { Suspense } from "react";
import { DevHomeAlerts } from "@/components/dev/DevHomeAlerts";
import ListingBrowseSection from "@/components/listings/ListingBrowseSection";
import Hero from "@/components/Hero";
import CategoryBar from "@/components/CategoryBar";
import TrustBar from "@/components/TrustBar";
import { HomeListHeading } from "@/components/home/HomeListHeading";
import {
  CountyServiceCatalogSection,
  type CountyServiceCatalogRow,
} from "@/components/home/CountyServiceCatalogSection";
import { ConciergeSearchHint, type TopListingQuote } from "@/components/home/ConciergeSearchHint";
import type { ConciergeRequest } from "@/lib/concierge-intent";
import { COLONIAS, COLONIA_RADIUS_KM, nearestColonia } from "@/lib/colonias";
import { getServerFetchOrigin } from "@/lib/app-url";
import { getServiceRoleRestHeaders, getSupabaseUrl } from "@/lib/service-rest";
import {
  embeddedSellerRow,
  isSellerDlVerifiedDisplay,
  isSellerEinVerifiedDisplay,
  isSellerPhoneVerifiedForDisplay,
} from "@/lib/seller-trust-display";
import { normalizeBrowseCategory } from "@/lib/marketplace-categories";
import { detectZipInQuery, normalizeUsZip5 } from "@/lib/us-zip";
import { geocodeUsZip } from "@/lib/geocode-us-zip";
import { postgrestActiveListingVerificationFragment } from "@/lib/browse-listings-filters";
import { langFromParam } from "@/lib/i18n-lang";
import { listingTitle } from "@/lib/listing-language";
import { formatUsdCents } from "@/lib/money";
import { inferProviderSlugFromListingTitle } from "@/lib/infer-listing-provider-slug";

import { censusCountySlugAtLngLat } from "@/lib/census-county-at-point";

export const dynamic = "force-dynamic";

function normalizeCountySlugParam(slug?: string): string {
  const k = slug?.trim().toLowerCase() ?? "";
  if (!k || !(k in COLONIAS) || k === "otro") return "";
  return k;
}

async function countyServiceCatalogRowsForKey(
  countyKey: string,
): Promise<CountyServiceCatalogRow[]> {
  if (!countyKey || countyKey === "otro") return [];
  const supaHeaders = getServiceRoleRestHeaders();
  const supaUrl = getSupabaseUrl();
  const catPath =
    `/rest/v1/county_service_catalog?county_key=eq.${encodeURIComponent(countyKey)}&active=eq.true` +
    `&select=service_slug,label_en,label_es,blurb_en,blurb_es,strategy_tag`;
  const catRes = await fetch(`${supaUrl}${catPath}`, { headers: supaHeaders, cache: "no-store" });
  if (!catRes.ok) return [];
  const raw = await catRes.json();
  return Array.isArray(raw) ? (raw as CountyServiceCatalogRow[]) : [];
}

/** Default map / fallback coordinates: geographic center of New Jersey */
const NJ_LAT = 40.0583;
const NJ_LNG = -74.4057;
function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, d2r = Math.PI / 180;
  const a = Math.sin(((lat2-lat1)*d2r)/2)**2 + Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(((lng2-lng1)*d2r)/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/** Hero `pmin` / `pmax`: whole US dollars (applied as USD cents on `price_mxn`). */
function parseWholeUsd(s: string | undefined): number | undefined {
  if (s == null || s === "") return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

interface Props {
  searchParams?: {
    q?: string;
    category?: string;
    lat?: string;
    lng?: string;
    lang?: string;
    colonia?: string;
    pmin?: string;
    pmax?: string;
    zip?: string;
  };
}

export default async function HomePage({ searchParams }: Props) {
  const categorySlug = normalizeBrowseCategory(searchParams?.category);
  const query       = searchParams?.q ?? "";
  const lang        = langFromParam(searchParams?.lang);
  const initialLang = lang;
  const validatedCountySlug = normalizeCountySlugParam(searchParams?.colonia);
  const pminUsd     = parseWholeUsd(searchParams?.pmin);
  const pmaxUsd     = parseWholeUsd(searchParams?.pmax);
  let coloniaData   = validatedCountySlug ? COLONIAS[validatedCountySlug] : null;
  let catalogCountyKey = validatedCountySlug;
  let userLat       = parseFloat(searchParams?.lat ?? "NaN");
  let userLng       = parseFloat(searchParams?.lng ?? "NaN");
  let hasGeo        = Number.isFinite(userLat) && Number.isFinite(userLng);
  let fetchQuery    = query;

  const zipGuessEarly =
    normalizeUsZip5(searchParams?.zip ?? "") ?? detectZipInQuery(fetchQuery)?.zip ?? null;

  let zipCentroidHit: Awaited<ReturnType<typeof geocodeUsZip>> = null;
  if (zipGuessEarly) {
    zipCentroidHit = await geocodeUsZip(zipGuessEarly);
    if (!hasGeo && zipCentroidHit) {
      userLat = zipCentroidHit.lat;
      userLng = zipCentroidHit.lng;
      hasGeo = true;
    }
    if (!normalizeUsZip5(searchParams?.zip ?? "")) {
      const fromText = detectZipInQuery(fetchQuery);
      if (fromText?.zip === zipGuessEarly) fetchQuery = fromText.cleanedQuery.trim();
    }
  }

  if (!validatedCountySlug && zipCentroidHit) {
    const cen = await censusCountySlugAtLngLat(zipCentroidHit.lng, zipCentroidHit.lat);
    if (cen?.slug) {
      if (!coloniaData) coloniaData = COLONIAS[cen.slug] ?? null;
      if (!catalogCountyKey) catalogCountyKey = cen.slug;
    }
  }

  const refLat = hasGeo ? userLat : (coloniaData?.lat ?? NJ_LAT);
  const refLng = hasGeo ? userLng : (coloniaData?.lng ?? NJ_LNG);

  const zipForSearchApi = normalizeUsZip5(searchParams?.zip ?? "") ?? detectZipInQuery(query)?.zip;

  let cards: any[] = [];
  let searchMode = "sparse";
  let countyCatalog: CountyServiceCatalogRow[] = [];
  let searchConcierge: ConciergeRequest | null = null;
  let searchCategoryHint: string | null = null;
  let topListingQuote: TopListingQuote | null = null;

  try {
    const supaHeaders = getServiceRoleRestHeaders();
    const supaUrl = getSupabaseUrl();

    if (categorySlug === "services" && catalogCountyKey && catalogCountyKey !== "otro") {
      countyCatalog = await countyServiceCatalogRowsForKey(catalogCountyKey);
    }

    if (fetchQuery.trim() || query.trim()) {
      // ── Use hybrid search API when query present ──────────────────────────
      const qEff = fetchQuery.trim() || query.trim();
      const params = new URLSearchParams({ q: qEff, category: categorySlug });
      if (zipForSearchApi) params.set("zip", zipForSearchApi);

      if (hasGeo) { params.set("lat", String(userLat)); params.set("lng", String(userLng)); }
      if (validatedCountySlug) { params.set("colonia", validatedCountySlug); }
      if (pminUsd != null && pminUsd > 0) params.set("pmin", String(pminUsd));
      if (pmaxUsd != null && pmaxUsd > 0) params.set("pmax", String(pmaxUsd));
      const res = await fetch(`${getServerFetchOrigin()}/api/search?${params}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        searchMode = data.mode ?? "sparse";
        searchConcierge = (data.concierge as ConciergeRequest | null) ?? data.debug?.parse?.concierge ?? null;
        searchCategoryHint =
          (typeof data.searchCategoryHint === "string" ? data.searchCategoryHint : null) ??
          data.debug?.parse?.searchCategoryHint ??
          null;
        topListingQuote = (data.topListingQuote as TopListingQuote | null) ?? null;
        const detectedColonia = data.colonia ?? null;
        cards = (data.results ?? []).map((row: any) => {
          const rLat = row.location_lat ?? NJ_LAT;
          const rLng = row.location_lng ?? NJ_LNG;
          const near = nearestColonia(rLat, rLng, undefined, lang);
          const u = embeddedSellerRow(row.users) as {
            display_name?: string | null;
            trust_badge?: string | null;
            dl_verified?: boolean | null;
            ein_verified?: boolean | null;
            ine_verified?: boolean | null;
            rfc_verified?: boolean | null;
            phone_verified?: boolean | null;
          } | null;
          return {
            id: row.id,
            title: listingTitle(row, lang),
            price_mxn: row.price_mxn,
            price_display: formatUsdCents(row.price_mxn, lang),
            category_id: row.category_id, condition: row.condition,
            location_city: row.location_city ?? "New Jersey",
            colonia_label: near?.label ?? null,
            photo_url: row.photo_urls?.[0] ?? null,
            location_lat: row.location_lat ?? null,
            location_lng: row.location_lng ?? null,
            shipping_available: row.shipping_available, negotiable: row.negotiable,
            seller_name: u?.display_name ?? "Proveedor",
            seller_badge: u?.trust_badge ?? "none",
            seller_dl_verified: isSellerDlVerifiedDisplay(u),
            seller_ein_verified: isSellerEinVerifiedDisplay(u),
            seller_phone_verified: isSellerPhoneVerifiedForDisplay(u),
            listing_admin_verified: Boolean(row.is_verified),
            payment_methods: row.payment_methods ?? null,
            _dist_km: row._dist_km ?? null,
            dist_km: row._dist_km ?? null,
            _mode: row._mode,
            provider_slug: inferProviderSlugFromListingTitle(
              String(row.title_en ?? row.title_es ?? ""),
            ),
          };
        });
        const effSlug =
          typeof detectedColonia?.key === "string" &&
          detectedColonia.key in COLONIAS &&
          detectedColonia.key !== "otro"
            ? detectedColonia.key
            : "";
        coloniaData = coloniaData ?? (effSlug ? COLONIAS[effSlug] ?? null : null);

        if (categorySlug === "services" && effSlug && !validatedCountySlug) {
          catalogCountyKey = effSlug;
          countyCatalog = await countyServiceCatalogRowsForKey(effSlug);
        }
      } else {
        const msg = await res.text().catch(() => "");
        console.error("[home] /api/search", res.status, msg.slice(0, 500));
      }
    } else {
      // ── No query: show active listings for selected category ───────────────────────────────────
      const verifyFrag = postgrestActiveListingVerificationFragment(categorySlug);
      let priceQs = "";
      if (pminUsd != null && pminUsd > 0) priceQs += `&price_mxn=gte.${pminUsd * 100}`;
      if (pmaxUsd != null && pmaxUsd > 0) priceQs += `&price_mxn=lte.${pmaxUsd * 100}`;
      const basePath =
        `/rest/v1/listings?${verifyFrag}&category_id=eq.${categorySlug}` +
        `&order=created_at.desc&limit=48` +
        priceQs;
      const colsBase =
        "id,title_es,title_en,title_hi,title_gu,price_mxn,category_id,condition,is_verified,location_city,location_lat,location_lng,shipping_available,negotiable,photo_urls,payment_methods";
      const colsEmbed =
        colsBase +
        ",users!fk_listings_seller(display_name,trust_badge,dl_verified,ein_verified,ine_verified,rfc_verified,phone_verified)";

      let browseRes = await fetch(
        `${supaUrl}${basePath}&select=${encodeURIComponent(colsEmbed)}`,
        { headers: supaHeaders, cache: "no-store" }
      );
      if (!browseRes.ok) {
        const embErr = await browseRes.text().catch(() => "");
        console.warn("[home] browse with seller embed failed", browseRes.status, embErr.slice(0, 500));
        browseRes = await fetch(`${supaUrl}${basePath}&select=${encodeURIComponent(colsBase)}`, {
          headers: supaHeaders,
          cache: "no-store",
        });
      }
      if (browseRes.ok) {
        const data = await browseRes.json();
        let rows = Array.isArray(data) ? data : [];

        if (coloniaData) {
          const cd = coloniaData;
          rows = rows.filter((row: any) => {
            const km = distKm(cd.lat, cd.lng, row.location_lat ?? NJ_LAT, row.location_lng ?? NJ_LNG);
            return km <= COLONIA_RADIUS_KM;
          });
        }

        cards = rows.map((row: any) => {
          const rLat = row.location_lat ?? NJ_LAT;
          const rLng = row.location_lng ?? NJ_LNG;
          const km = distKm(refLat, refLng, rLat, rLng);
          const near = nearestColonia(rLat, rLng, undefined, lang);
          const u = embeddedSellerRow(row.users) as {
            display_name?: string | null;
            trust_badge?: string | null;
            dl_verified?: boolean | null;
            ein_verified?: boolean | null;
            ine_verified?: boolean | null;
            rfc_verified?: boolean | null;
            phone_verified?: boolean | null;
          } | null;
          return {
            id: row.id,
            title: listingTitle(row, lang),
            price_mxn: row.price_mxn,
            price_display: formatUsdCents(row.price_mxn, lang),
            category_id: row.category_id, condition: row.condition,
            location_city: row.location_city ?? "New Jersey",
            colonia_label: near?.label ?? null,
            photo_url: row.photo_urls?.[0] ?? null,
            location_lat: row.location_lat ?? null,
            location_lng: row.location_lng ?? null,
            shipping_available: row.shipping_available, negotiable: row.negotiable,
            seller_name: u?.display_name ?? "Proveedor",
            seller_badge: u?.trust_badge ?? "none",
            seller_dl_verified: isSellerDlVerifiedDisplay(u),
            seller_ein_verified: isSellerEinVerifiedDisplay(u),
            seller_phone_verified: isSellerPhoneVerifiedForDisplay(u),
            listing_admin_verified: Boolean(row.is_verified),
            payment_methods: row.payment_methods ?? null,
            _dist_km: Math.round(km * 10) / 10,
            dist_km: Math.round(km * 10) / 10,
          };
        }).sort((a: any, b: any) => a._dist_km - b._dist_km);
      } else {
        const msg = await browseRes.text().catch(() => "");
        console.error("[home] listings REST (embed + fallback)", browseRes.status, msg.slice(0, 800));
      }
    }
  } catch (e) { console.error("Search error:", e); }

  const isHybrid = searchMode === "hybrid";

  const devMissingSupabase =
    process.env.NODE_ENV === "development" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  const devPendingServices =
    process.env.NODE_ENV === "development" && process.env.SHOW_PENDING_SERVICES === "true";

  return (
    <main className="min-h-screen bg-[#FDF8F1]">
      <CategoryBar />
      <Hero initialQuery={query} />
      <DevHomeAlerts missingSupabase={devMissingSupabase} pendingServices={devPendingServices} />
      <section className="max-w-5xl mx-auto px-4 py-10">
        <Suspense
          fallback={
            <div className="h-32 mb-6 rounded-xl bg-[#F4F0EB] animate-pulse" aria-hidden />
          }
        >
          {categorySlug === "services" &&
            catalogCountyKey &&
            catalogCountyKey !== "otro" && (
              <CountyServiceCatalogSection
                lang={lang}
                countyKey={catalogCountyKey}
                items={countyCatalog}
              />
            )}
          {query.trim() && (
            <ConciergeSearchHint
              lang={lang}
              query={query}
              concierge={searchConcierge}
              searchCategoryHint={searchCategoryHint}
              topListing={topListingQuote}
              shopperLat={searchParams?.lat ?? null}
              shopperLng={searchParams?.lng ?? null}
            />
          )}
        </Suspense>
        <div id="listing-results">
        <Suspense
          fallback={
            <div className="h-32 mb-6 rounded-xl bg-[#F4F0EB] animate-pulse" aria-hidden />
          }
        >
          <HomeListHeading
            initialLang={initialLang}
            initialCategory={categorySlug}
            query={query}
            coloniaData={coloniaData}
            hasGeo={hasGeo}
            isHybrid={isHybrid}
            cardCount={cards.length}
          />
        </Suspense>
        <Suspense
          fallback={
            <div className="h-[28rem] max-w-5xl rounded-2xl bg-[#F4F0EB] animate-pulse mb-6" aria-hidden />
          }
        >
          <ListingBrowseSection
            listings={cards}
            initialLang={initialLang}
            initialCategory={categorySlug}
            mapCenterLat={refLat}
            mapCenterLng={refLng}
            isDev={process.env.NODE_ENV === "development"}
            devPendingServicesEnabled={devPendingServices}
            searchQuery={query.trim() || undefined}
          />
        </Suspense>
        </div>
      </section>
      <TrustBar />
    </main>
  );
}
