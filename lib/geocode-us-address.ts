type NominatimHit = {
  lat?: string;
  lon?: string;
  display_name?: string;
};

/**
 * Approximate US address → lat/lng via OpenStreetMap Nominatim (no API key).
 * Biases queries toward New Jersey when no state is present.
 */
export async function geocodeUsAddress(queryRaw: string): Promise<{
  lat: number;
  lng: number;
  label?: string;
} | null> {
  const q = String(queryRaw ?? "").trim();
  if (q.length < 4) return null;

  const hasState = /\b(NJ|New Jersey)\b/i.test(q);
  const searchQ = hasState ? `${q}, USA` : `${q}, New Jersey, USA`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", searchQ);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "us");

    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Sarvaone/1.0 (local-services; contact@sarvaone.com)",
      },
    });
    if (!res.ok) return null;
    const hits = (await res.json()) as NominatimHit[];
    const hit = hits?.[0];
    if (!hit?.lat || !hit.lon) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      label: typeof hit.display_name === "string" ? hit.display_name : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function googleMapsPointUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}
