import type { Lang } from "@/lib/i18n-lang";

const KM_TO_MI = 0.621371;

export function kmToMiles(km: number): number {
  return km * KM_TO_MI;
}

/** US-first: show distance in miles (one decimal). */
export function formatListingDistanceMi(km: number | null | undefined, lang: Lang): string | null {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  const mi = kmToMiles(km);
  if (mi < 0.1) {
    return lang === "es" ? "Cerca" : "Nearby";
  }
  const rounded = mi < 10 ? Math.round(mi * 10) / 10 : Math.round(mi);
  return lang === "es" ? `A ${rounded} mi` : `${rounded} mi away`;
}

export function distKmBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const d2r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * d2r) / 2) ** 2 +
    Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(((lng2 - lng1) * d2r) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
