import type { Lang } from "@/lib/i18n-lang";

export interface ColoniaInfo {
  lat: number;
  lng: number;
  label: string;
  label_en: string;
  aliases: string[];
}

/** New Jersey counties (21) + `otro` = statewide default centroid. Keys are URL-safe slugs. */
export const COLONIAS: Record<string, ColoniaInfo> = {
  atlantic: {
    lat: 39.47,
    lng: -74.65,
    label: "Condado de Atlantic",
    label_en: "Atlantic County",
    aliases: ["atlantic", "atlantic county", "condado atlantic", "atlantic co"],
  },
  bergen: {
    lat: 40.96,
    lng: -74.0,
    label: "Condado de Bergen",
    label_en: "Bergen County",
    aliases: ["bergen", "bergen county", "condado bergen"],
  },
  burlington: {
    lat: 40.1,
    lng: -74.72,
    label: "Condado de Burlington",
    label_en: "Burlington County",
    aliases: ["burlington", "burlington county", "condado burlington"],
  },
  camden: {
    lat: 39.8,
    lng: -75.04,
    label: "Condado de Camden",
    label_en: "Camden County",
    aliases: ["camden", "camden county", "condado camden"],
  },
  cape_may: {
    lat: 39.11,
    lng: -74.86,
    label: "Condado de Cape May",
    label_en: "Cape May County",
    aliases: ["cape may", "cape may county", "condado cape may"],
  },
  cumberland: {
    lat: 39.5,
    lng: -75.12,
    label: "Condado de Cumberland",
    label_en: "Cumberland County",
    aliases: ["cumberland", "cumberland county", "condado cumberland"],
  },
  essex: {
    lat: 40.79,
    lng: -74.21,
    label: "Condado de Essex",
    label_en: "Essex County",
    aliases: ["essex", "essex county", "condado essex", "newark"],
  },
  gloucester: {
    lat: 39.77,
    lng: -75.09,
    label: "Condado de Gloucester",
    label_en: "Gloucester County",
    aliases: ["gloucester", "gloucester county", "condado gloucester"],
  },
  hudson: {
    lat: 40.74,
    lng: -74.03,
    label: "Condado de Hudson",
    label_en: "Hudson County",
    aliases: ["hudson", "hudson county", "condado hudson", "jersey city"],
  },
  hunterdon: {
    lat: 40.51,
    lng: -74.92,
    label: "Condado de Hunterdon",
    label_en: "Hunterdon County",
    aliases: ["hunterdon", "hunterdon county", "condado hunterdon"],
  },
  mercer: {
    lat: 40.28,
    lng: -74.76,
    label: "Condado de Mercer",
    label_en: "Mercer County",
    aliases: ["mercer", "mercer county", "condado mercer", "trenton"],
  },
  middlesex: {
    lat: 40.44,
    lng: -74.4,
    label: "Condado de Middlesex",
    label_en: "Middlesex County",
    aliases: ["middlesex", "middlesex county", "condado middlesex", "new brunswick"],
  },
  monmouth: {
    lat: 40.28,
    lng: -74.01,
    label: "Condado de Monmouth",
    label_en: "Monmouth County",
    aliases: ["monmouth", "monmouth county", "condado monmouth", "freehold"],
  },
  morris: {
    lat: 40.86,
    lng: -74.55,
    label: "Condado de Morris",
    label_en: "Morris County",
    aliases: ["morris", "morris county", "condado morris", "morristown"],
  },
  ocean: {
    lat: 39.97,
    lng: -74.23,
    label: "Condado de Ocean",
    label_en: "Ocean County",
    aliases: ["ocean", "ocean county", "condado ocean", "toms river"],
  },
  passaic: {
    lat: 41.03,
    lng: -74.3,
    label: "Condado de Passaic",
    label_en: "Passaic County",
    aliases: ["passaic", "passaic county", "condado passaic", "paterson"],
  },
  salem: {
    lat: 39.58,
    lng: -75.35,
    label: "Condado de Salem",
    label_en: "Salem County",
    aliases: ["salem", "salem county", "condado salem"],
  },
  somerset: {
    lat: 40.57,
    lng: -74.65,
    label: "Condado de Somerset",
    label_en: "Somerset County",
    aliases: ["somerset", "somerset county", "condado somerset", "bridgewater"],
  },
  sussex: {
    lat: 41.18,
    lng: -74.68,
    label: "Condado de Sussex",
    label_en: "Sussex County",
    aliases: ["sussex", "sussex county", "condado sussex"],
  },
  union: {
    lat: 40.69,
    lng: -74.28,
    label: "Condado de Union",
    label_en: "Union County",
    aliases: ["union", "union county", "condado union", "elizabeth"],
  },
  warren: {
    lat: 40.87,
    lng: -74.97,
    label: "Condado de Warren",
    label_en: "Warren County",
    aliases: ["warren", "warren county", "condado warren"],
  },
  otro: {
    lat: 40.0583,
    lng: -74.4057,
    label: "Nueva Jersey",
    label_en: "New Jersey",
    aliases: [],
  },
};

export const COLONIA_KEYS = Object.keys(COLONIAS).filter((k) => k !== "otro");

export const ALL_COLONIA_KEYS = Object.keys(COLONIAS);

export function coloniaLabel(key: string, lang: Lang = "en"): string {
  const c = COLONIAS[key];
  if (!c) return key;
  if (lang === "es") return c.label;
  return c.label_en;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Detect a county name inside a free-text query.
 * Returns the county key and the query with the place name removed,
 * or null if no county was found.
 */
export function detectColoniaInQuery(query: string): { coloniaKey: string; cleanedQuery: string } | null {
  const norm = normalize(query);
  let bestMatch: { key: string; alias: string; len: number } | null = null;

  for (const [key, info] of Object.entries(COLONIAS)) {
    if (key === "otro") continue;
    for (const alias of info.aliases) {
      const normAlias = normalize(alias);
      if (norm.includes(normAlias) && (!bestMatch || normAlias.length > bestMatch.len)) {
        bestMatch = { key, alias: normAlias, len: normAlias.length };
      }
    }
  }

  if (!bestMatch) return null;

  const idx = norm.indexOf(bestMatch.alias);
  const cleaned = (query.slice(0, idx) + query.slice(idx + bestMatch.len))
    .replace(/\s*(en|in|de|del|la|el|los|las|por|,)\s*$/i, "")
    .replace(/^\s*(en|in|de|del|la|el|los|las|por|,)\s*/i, "")
    .trim();

  return { coloniaKey: bestMatch.key, cleanedQuery: cleaned };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r, dLng = (lng2 - lng1) * d2r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Rough disk filter around each county centroid when the shopper picks a NJ county chip.
 * Too large overlaps the next county (e.g. Middlesex demos ~43km from Monmouth centroid could
 * satisfy a 72km disk). ~38km keeps most of one NJ county near its centroid without swallowing the
 * whole adjacent county; `colonia_relaxed` may still widen if nothing matches locally.
 */
export const COLONIA_RADIUS_KM = 38;

/**
 * Given lat/lng, find the nearest county (excluding "otro").
 * Returns null if the nearest county centroid is farther than maxKm.
 */
export function nearestColonia(
  lat: number,
  lng: number,
  maxKm = COLONIA_RADIUS_KM,
  lang: Lang = "en",
): { key: string; label: string; distKm: number } | null {
  let best: { key: string; label: string; distKm: number } | null = null;
  for (const [key, info] of Object.entries(COLONIAS)) {
    if (key === "otro") continue;
    const d = haversineKm(lat, lng, info.lat, info.lng);
    if (d <= maxKm && (!best || d < best.distKm)) {
      const label = lang === "es" ? info.label : info.label_en;
      best = { key, label, distKm: Math.round(d * 10) / 10 };
    }
  }
  return best;
}
