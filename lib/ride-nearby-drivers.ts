import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicAppUrl } from "@/lib/app-url";
import { isTransportListingTitle } from "@/lib/ride-trip-addresses";
import { phoneDigitsForAccountPool } from "@/lib/user-phone-notify";
import { sendWhatsAppToE164Digits, isTwilioWhatsAppConfigured } from "@/lib/twilio";

const NEARBY_RADIUS_KM = 38;
const NEARBY_NOTIFY_LIMIT = 3;

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const d2r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * d2r) / 2) ** 2 +
    Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(((lng2 - lng1) * d2r) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type NearbyListing = {
  id: string;
  title_es: string;
  seller_id: string;
  location_lat: number;
  location_lng: number;
  _dist_km: number;
};

/**
 * Phase 3 — ping up to 3 other verified taxi listings near the request origin.
 * Does not auto-assign; drivers opt in by opening their listing / chat.
 */
export async function notifyNearbyDriversForRideRequest(opts: {
  supabase: SupabaseClient;
  originListingId: string;
  originSellerId: string;
  refLat: number;
  refLng: number;
  buyerName: string;
  pickupSummary: string;
  lang?: "es" | "en";
}): Promise<{ notified: number }> {
  if (!isTwilioWhatsAppConfigured()) return { notified: 0 };

  const { data: rows, error } = await opts.supabase
    .from("listings")
    .select("id,title_es,title_en,seller_id,location_lat,location_lng")
    .eq("status", "active")
    .eq("is_verified", true)
    .eq("category_id", "services")
    .not("location_lat", "is", null)
    .not("location_lng", "is", null);

  if (error || !rows?.length) {
    if (error) console.error("[ride-nearby] listings query", error.message);
    return { notified: 0 };
  }

  const candidates: NearbyListing[] = [];
  for (const row of rows) {
    const id = String(row.id);
    if (id === opts.originListingId) continue;
    const title = String(row.title_es ?? row.title_en ?? "");
    if (!isTransportListingTitle(title)) continue;
    const sellerId = String(row.seller_id ?? "");
    if (sellerId === opts.originSellerId) continue;
    const lat = Number(row.location_lat);
    const lng = Number(row.location_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const km = distKm(opts.refLat, opts.refLng, lat, lng);
    if (km > NEARBY_RADIUS_KM) continue;
    candidates.push({
      id,
      title_es: title,
      seller_id: sellerId,
      location_lat: lat,
      location_lng: lng,
      _dist_km: km,
    });
  }

  candidates.sort((a, b) => a._dist_km - b._dist_km);
  const targets = candidates.slice(0, NEARBY_NOTIFY_LIMIT);
  const lang = opts.lang ?? "en";
  const appUrl = getPublicAppUrl();
  let notified = 0;

  for (const listing of targets) {
    const digits = await phoneDigitsForAccountPool(opts.supabase, listing.seller_id);
    if (!digits) continue;

    const browseLink = `${appUrl}/listing/${listing.id}?lang=${lang}`;
    const msg =
      lang === "en"
        ? [
            "🚕 *Nearby ride request — Sarvaone*",
            "",
            `A rider contacted another driver but you are ~${listing._dist_km.toFixed(1)} km away.`,
            `From: *${opts.buyerName}*`,
            `Pickup: ${opts.pickupSummary.slice(0, 120)}`,
            "",
            "Open your listing to respond if you are available (no auto-dispatch).",
            browseLink,
          ].join("\n")
        : [
            "🚕 *Solicitud de viaje cercana — Sarvaone*",
            "",
            `Un pasajero contactó a otro conductor; tú estás a ~${listing._dist_km.toFixed(1)} km.`,
            `Cliente: *${opts.buyerName}*`,
            `Recogida: ${opts.pickupSummary.slice(0, 120)}`,
            "",
            "Abre tu anuncio para responder si estás disponible (sin asignación automática).",
            browseLink,
          ].join("\n");

    const ok = await sendWhatsAppToE164Digits(digits, msg);
    if (ok) notified += 1;
  }

  return { notified };
}
