import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicAppUrl } from "@/lib/app-url";
import { phoneDigitsForAccountPool } from "@/lib/user-phone-notify";
import { sendWhatsAppToE164Digits, isTwilioWhatsAppConfigured } from "@/lib/twilio";

export async function notifyBuyerDriverEnRoute(opts: {
  supabase: SupabaseClient;
  buyerId: string;
  listingTitle: string;
  mapsUrl: string | null;
  lang?: "es" | "en";
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) return;
  const digits = await phoneDigitsForAccountPool(opts.supabase, opts.buyerId);
  if (!digits) return;

  const lang = opts.lang ?? "en";
  const appUrl = getPublicAppUrl();
  const bookingsLink = `${appUrl}/my-bookings?lang=${lang}`;

  const lines =
    lang === "en"
      ? [
          "🚕 *Your driver is on the way — Sarvaone*",
          "",
          `Trip: *${opts.listingTitle}*`,
          opts.mapsUrl ? `Driver location: ${opts.mapsUrl}` : "Your driver marked the trip as en route.",
          "",
          `Track details: ${bookingsLink}`,
        ]
      : [
          "🚕 *Tu conductor va en camino — Sarvaone*",
          "",
          `Viaje: *${opts.listingTitle}*`,
          opts.mapsUrl
            ? `Ubicación del conductor: ${opts.mapsUrl}`
            : "Tu conductor marcó el viaje como en camino.",
          "",
          `Detalles: ${bookingsLink}`,
        ];

  const ok = await sendWhatsAppToE164Digits(digits, lines.join("\n"));
  if (!ok) {
    console.error("[ride-en-route] buyer WhatsApp failed", { buyerIdTail: String(opts.buyerId).slice(-8) });
  }
}
