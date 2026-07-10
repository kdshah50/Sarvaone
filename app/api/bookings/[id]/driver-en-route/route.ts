import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getUserIdFromRequest, idMatchVariantsForIn } from "@/lib/auth-server";
import { expandUserAccountIdPool, poolsOverlap } from "@/lib/user-account-pool";
import { googleMapsPointUrl } from "@/lib/geocode-us-address";
import { notifyBuyerDriverEnRoute } from "@/lib/ride-driver-en-route-notify";
import { isTransportListingTitle } from "@/lib/ride-trip-addresses";
import { sellerCanManagePaidBookingRow } from "@/lib/seller-booking-access";

export const dynamic = "force-dynamic";

/**
 * POST — driver shares "I'm on my way" with optional browser geolocation snapshot.
 * Body: { lat?: number, lng?: number, lang?: "es" | "en" }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const bookingId = params.id?.trim();
    if (!bookingId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const lat = Number((body as { lat?: unknown }).lat);
    const lng = Number((body as { lng?: unknown }).lng);
    const lang = (body as { lang?: string }).lang === "es" ? "es" : "en";

    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const mapsUrl = hasCoords ? googleMapsPointUrl(lat, lng) : null;

    const supabase = createAdminSupabase();
    const idVars = idMatchVariantsForIn(bookingId);
    if (idVars.length === 0) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const { data: booking } = await supabase
      .from("service_bookings")
      .select("id,buyer_id,seller_id,listing_id,payment_status,status,driver_en_route_at")
      .in("id", idVars)
      .maybeSingle();

    if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const myPool = await expandUserAccountIdPool(supabase, userId);
    const poolVariants = [...new Set(myPool.flatMap((id) => idMatchVariantsForIn(id)))];
    if (!(await sellerCanManagePaidBookingRow(supabase, poolVariants, booking))) {
      return NextResponse.json({ error: "Solo el conductor del anuncio puede marcar en camino" }, { status: 403 });
    }

    if (booking.payment_status !== "paid") {
      return NextResponse.json({ error: "La reserva debe estar pagada" }, { status: 400 });
    }

    const st = String(booking.status ?? "").toLowerCase();
    if (st === "cancelled" || st === "completed") {
      return NextResponse.json({ error: "La reserva ya está cerrada" }, { status: 400 });
    }

    const { data: listing } = await supabase
      .from("listings")
      .select("title_es,title_en")
      .eq("id", booking.listing_id)
      .maybeSingle();

    const title = String(listing?.title_es ?? listing?.title_en ?? "");
    if (!isTransportListingTitle(title)) {
      return NextResponse.json({ error: "Solo aplica a reservas de taxi / transporte" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("service_bookings")
      .update({
        driver_en_route_at: now,
        driver_location_lat: hasCoords ? lat : null,
        driver_location_lng: hasCoords ? lng : null,
        driver_location_maps_url: mapsUrl,
        updated_at: now,
      })
      .eq("id", booking.id);

    if (upErr) {
      console.error("[driver-en-route]", upErr);
      return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
    }

    try {
      await notifyBuyerDriverEnRoute({
        supabase,
        buyerId: String(booking.buyer_id),
        listingTitle: title,
        mapsUrl,
        lang,
      });
    } catch (e) {
      console.error("[driver-en-route] notify failed (non-fatal)", e);
    }

    return NextResponse.json({
      ok: true,
      driverEnRouteAt: now,
      driverLocationMapsUrl: mapsUrl,
    });
  } catch (e) {
    console.error("[driver-en-route] POST", e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
