import "server-only";

import { COLONIAS, detectColoniaInQuery } from "@/lib/colonias";
import { detectZipInQuery, normalizeUsZip5 } from "@/lib/us-zip";
import { geocodeUsZip } from "@/lib/geocode-us-zip";
import { censusCountySlugAtLngLat } from "@/lib/census-county-at-point";
import { nominatimGeocodeNjPlace } from "@/lib/nominatim-nj-geocode";
import { extractNjPlaceFromQuery } from "@/lib/extract-nj-place-from-query";

export type NjLocationEnrichment = "none" | "colonia_alias" | "zip_county" | "city_osm";

export type NjShopperSearchContextInfer = {
  cleanedQuery: string;
  inferredCountySlug: string;
  shopperLat: number | null;
  shopperLng: number | null;
  enrichment: NjLocationEnrichment;
  geoZipApplied: string | null;
};

function isValidCountyChip(k: string): boolean {
  return Boolean(k && k !== "otro" && k in COLONIAS);
}

/**
 * Strip ZIP / placenames, fill shopper coords, infer NJ county.
 * Resolved **township (Nominatim)** overrides ZIP centroid county and mismatched `lockedColoniaSlug`
 * (e.g. hero chip stayed Middlesex while the shopper typed Eatontown).
 */
export async function inferNjShopperSearchContext(opts: {
  rawQuery: string;
  zipParam?: string | null;
  shopperLat?: number | null;
  shopperLng?: number | null;
  lockedColoniaSlug?: string | null;
}): Promise<NjShopperSearchContextInfer> {
  let cleaned = opts.rawQuery.trim().replace(/\s+/g, " ");

  let lat =
    opts.shopperLat != null && Number.isFinite(opts.shopperLat) ? opts.shopperLat : null;
  let lng =
    opts.shopperLng != null && Number.isFinite(opts.shopperLng) ? opts.shopperLng : null;

  const locked = (opts.lockedColoniaSlug ?? "").trim().toLowerCase();
  const lockedValid = isValidCountyChip(locked);

  let slugAlias = "";
  if (!lockedValid) {
    const hitAlias = detectColoniaInQuery(cleaned);
    if (hitAlias) {
      slugAlias = hitAlias.coloniaKey;
      cleaned = (hitAlias.cleanedQuery ?? cleaned).replace(/\s+/g, " ").trim();
    }
  }

  const zipFromParam = normalizeUsZip5(opts.zipParam ?? "");
  const zipInText = detectZipInQuery(cleaned);
  const zipResolved = zipFromParam ?? zipInText?.zip ?? null;

  let geoZipApplied: string | null = null;
  let slugZip = "";

  if (zipResolved) {
    geoZipApplied = zipResolved;
    if (zipInText?.zip === zipResolved) {
      cleaned = zipInText.cleanedQuery.replace(/\s+/g, " ").trim();
    }
    const geo = await geocodeUsZip(zipResolved);
    if (geo) {
      if (lat == null || lng == null) {
        lat = geo.lat;
        lng = geo.lng;
      }
      const c = await censusCountySlugAtLngLat(geo.lng, geo.lat);
      if (c?.slug) slugZip = c.slug;
    }
  }

  let countyFromTown: string | null = null;

  const placeExtract = extractNjPlaceFromQuery(cleaned);
  if (placeExtract) {
    const nom = await nominatimGeocodeNjPlace(placeExtract.phrase);
    cleaned = placeExtract.strippedQuery.replace(/\s+/g, " ").trim();

    if (nom?.coloniaSlug) {
      if (!lockedValid || nom.coloniaSlug !== locked) {
        countyFromTown = nom.coloniaSlug;
      }
      if (lat == null || lng == null) {
        lat = nom.lat;
        lng = nom.lng;
      }
    }
  }

  let inferredCountySlug = "";
  let enrichment: NjLocationEnrichment = "none";

  if (countyFromTown) {
    inferredCountySlug = countyFromTown;
    enrichment = "city_osm";
  } else if (!lockedValid && slugAlias) {
    inferredCountySlug = slugAlias;
    enrichment = "colonia_alias";
  } else if (slugZip) {
    inferredCountySlug = slugZip;
    enrichment = "zip_county";
  }

  return {
    cleanedQuery: cleaned,
    inferredCountySlug,
    shopperLat: lat,
    shopperLng: lng,
    enrichment,
    geoZipApplied,
  };
}
