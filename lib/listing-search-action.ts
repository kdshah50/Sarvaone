import type { Lang } from "@/lib/i18n-lang";
import { withLang } from "@/lib/i18n-lang";
import { providerServiceRequiresQuoteAccept } from "@/lib/provider-services";

/** Deep link from home search → listing chat / quote (verified provider CTA). */
export function listingSearchActionHref(
  listingId: string,
  lang: Lang,
  opts?: {
    lat?: string | null;
    lng?: string | null;
    providerSlug?: string | null;
    fromQuery?: string | null;
  },
): string {
  const params = new URLSearchParams();
  const quoteFlow = providerServiceRequiresQuoteAccept(opts?.providerSlug);
  if (quoteFlow) params.set("quote", "1");
  else params.set("from_search", "1");
  if (opts?.lat && opts?.lng) {
    params.set("lat", opts.lat);
    params.set("lng", opts.lng);
  }
  if (opts?.fromQuery?.trim()) {
    params.set("from_q", opts.fromQuery.trim().slice(0, 120));
  }
  const qs = params.toString();
  const path = `/listing/${listingId}${qs ? `?${qs}` : ""}#listing-inapp-chat`;
  return withLang(path, lang);
}
