"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ListingCard } from "@/lib/types";
import { WhatsAppBadgeLocked } from "@/components/WhatsAppCTA";
import { SellerVerificationBadges } from "@/components/SellerVerificationBadges";
import { DEFAULT_LANG, langFromParam, listingHref, type Lang } from "@/lib/i18n-lang";
import { formatListingDistanceMi } from "@/lib/listing-distance";
import { UsdCents } from "@/components/UsdAmount";
import { isServiceVerticalCategory, normalizeBrowseCategory } from "@/lib/marketplace-categories";
import { listingSearchActionHref } from "@/lib/listing-search-action";

type Props = {
  listings: ListingCard[];
  /** Must match `?lang=` on first paint; then synced from the URL on the client. */
  initialLang?: Lang;
  /** Same as server `normalizeBrowseCategory(searchParams.category)` for first paint. */
  initialCategory: string;
  /** From server: `process.env.NODE_ENV === "development"`. */
  isDev?: boolean;
  /** From server: dev + `SHOW_PENDING_SERVICES=true` — browse already includes unverified services. */
  devPendingServicesEnabled?: boolean;
  searchQuery?: string;
};

export default function ListingGrid({
  listings,
  initialLang = DEFAULT_LANG,
  initialCategory,
  isDev = false,
  devPendingServicesEnabled = false,
  searchQuery,
}: Props) {
  const params = useSearchParams();
  const [lang, setLang] = useState<Lang>(initialLang);
  const [categorySlug, setCategorySlug] = useState(() => normalizeBrowseCategory(initialCategory));
  const activeSearchQuery = (searchQuery ?? params.get("q") ?? "").trim();

  useEffect(() => {
    setLang(langFromParam(params.get("lang")));
  }, [params]);

  useEffect(() => {
    setCategorySlug(normalizeBrowseCategory(params.get("category")));
  }, [params]);

  if (!listings.length) {
    const category = categorySlug;
    const isServiceVertical = isServiceVerticalCategory(category);

    const hasColonia = Boolean(params.get("colonia"));
    const hasPrice = Boolean(params.get("pmin") || params.get("pmax"));

    const clearLocationPriceHref = () => {
      const p = new URLSearchParams(params.toString());
      for (const k of ["colonia", "lat", "lng", "pmin", "pmax"]) p.delete(k);
      const s = p.toString();
      return s ? `/?${s}` : "/";
    };

    let emptyMsg: string;
    if (lang === "en") {
      if (isServiceVertical && hasColonia) {
        emptyMsg =
          "No approved listings for this service category in your current county filter.";
      } else {
        emptyMsg = isServiceVertical
          ? "No approved listings in this service category yet."
          : "No matching listings.";
      }
    } else {
      if (isServiceVertical && hasColonia) {
        emptyMsg =
          "No hay anuncios aprobados en esta categoría con el filtro de condado actual.";
      } else {
        emptyMsg = isServiceVertical
          ? "Aún no hay anuncios aprobados en esta categoría de servicios."
          : "No hay artículos que coincidan.";
      }
    }

    const showLocalPendingTip = isDev && isServiceVertical && !devPendingServicesEnabled;

    return (
      <div className="text-center py-16 max-w-lg mx-auto px-4">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-[#374151] text-lg font-medium">{emptyMsg}</p>
        {(hasColonia || hasPrice) && (
          <Link
            href={clearLocationPriceHref()}
            className="inline-block mt-4 text-sm font-semibold text-[#1B4332] underline"
          >
            {lang === "en" ? "Clear county & price filters" : "Quitar filtro de condado y precio"}
          </Link>
        )}
        {isServiceVertical && (
          <div className="text-[#6B7280] text-sm mt-5 text-left bg-[#F4F0EB] rounded-xl p-4 border border-[#E5E0D8] space-y-2">
            <p className="font-medium text-[#374151]">
              {lang === "en" ? "Why is this empty?" : "¿Por qué está vacío?"}
            </p>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li>
                {lang === "en" ? (
                  <>
                    The site only shows services that are <strong>approved</strong> (
                    <code className="text-xs bg-white px-1 rounded">is_verified = true</code> in
                    Supabase). Approve on{" "}
                    <Link href="/admin" className="text-[#1B4332] font-semibold underline">
                      /admin
                    </Link>{" "}
                    (needs <code className="text-xs bg-white px-1 rounded">ADMIN_PIN</code>).
                  </>
                ) : (
                  <>
                    Solo se muestran servicios <strong>aprobados</strong> (
                    <code className="text-xs bg-white px-1 rounded">is_verified = true</code> en
                    Supabase). Aprueba en{" "}
                    <Link href="/admin" className="text-[#1B4332] font-semibold underline">
                      /admin
                    </Link>{" "}
                    (requiere <code className="text-xs bg-white px-1 rounded">ADMIN_PIN</code>).
                  </>
                )}
              </li>
              <li>
                {lang === "en" ? (
                  <>
                    For demo data, run <code className="text-xs bg-white px-1 rounded">supabase/seed-demo-service-listings.sql</code> in the SQL Editor (verified listings).
                  </>
                ) : (
                  <>
                    Para datos de prueba, ejecuta{" "}
                    <code className="text-xs bg-white px-1 rounded">supabase/seed-demo-service-listings.sql</code> en el
                    editor SQL (anuncios verificados).
                  </>
                )}
              </li>
              {showLocalPendingTip && (
                <li>
                  {lang === "en" ? (
                    <>
                      <strong>Local dev:</strong> add{" "}
                      <code className="text-xs bg-white px-1 rounded">SHOW_PENDING_SERVICES=true</code> to{" "}
                      <code className="text-xs bg-white px-1 rounded">.env.local</code> and restart{" "}
                      <code className="text-xs bg-white px-1 rounded">npm run dev</code> to list{" "}
                      <em>pending</em> service rows without approving.
                    </>
                  ) : (
                    <>
                      <strong>Desarrollo local:</strong> añade{" "}
                      <code className="text-xs bg-white px-1 rounded">SHOW_PENDING_SERVICES=true</code> en{" "}
                      <code className="text-xs bg-white px-1 rounded">.env.local</code> y reinicia{" "}
                      <code className="text-xs bg-white px-1 rounded">npm run dev</code> para ver anuncios{" "}
                      <em>pendientes</em> sin aprobar.
                    </>
                  )}
                </li>
              )}
              {isDev && (
                <li>
                  <Link href="/api/dev/listings-sanity" className="text-[#1B4332] font-semibold underline">
                    /api/dev/listings-sanity
                  </Link>
                  {" — "}
                  {lang === "en"
                    ? "JSON counts from your Supabase (active verified vs pending, sample Beauty/Middlesex check)."
                    : "Conteos desde tu Supabase (activos verificados vs pendientes, muestra Belleza/Middlesex)."}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const negotiableHint = lang === "es" ? "· negociable" : "· negotiable";

  const listingDetailHref = (listing: ListingCard) => {
    const lat = params.get("lat");
    const lng = params.get("lng");
    const isServiceVertical = isServiceVerticalCategory(categorySlug);
    if (activeSearchQuery && isServiceVertical) {
      return listingSearchActionHref(listing.id, lang, {
        lat,
        lng,
        providerSlug: listing.provider_slug,
        fromQuery: activeSearchQuery,
      });
    }
    const base = listingHref(listing.id, lang);
    if (!lat || !lng) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  };

  const quoteChipLabel =
    lang === "es" ? "Solicitar cotización" : lang === "hi" ? "कोट माँगें" : lang === "gu" ? "ક્વોટ" : "Request quote";

  const isServiceVertical = isServiceVerticalCategory(categorySlug);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {listings.map((listing) => {
        const distanceLabel = formatListingDistanceMi(listing.dist_km, lang);
        return (
        <Link
          key={listing.id}
          href={listingDetailHref(listing)}
          className="group block"
        >
          <div className="bg-white rounded-2xl overflow-hidden border border-[#E5E0D8] hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="relative aspect-[16/9] bg-[#F4F0EB]">
              {listing.photo_url ? (
                <Image
                  src={listing.photo_url}
                  alt={listing.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-4xl text-[#E5E0D8]">
                  📦
                </div>
              )}
              <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 max-w-[85%]">
                {distanceLabel && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#1B4332]/90 text-white backdrop-blur-sm">
                    📍 {distanceLabel}
                  </span>
                )}
                {(listing.colonia_label || listing.location_city) && (
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-white/90 text-[#374151] backdrop-blur-sm">
                    {listing.colonia_label ?? listing.location_city}
                  </span>
                )}
              </div>
              {activeSearchQuery && isServiceVertical && (
                <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-full bg-[#D4A017] text-[#1B4332] shadow-sm">
                  {quoteChipLabel}
                </span>
              )}
            </div>

            <div className="p-4">
              <p className="text-lg font-bold text-[#1B4332] mb-1">
                <UsdCents cents={listing.price_mxn} lang={lang} />
                {listing.negotiable && (
                  <span className="text-xs font-normal text-[#6B7280] ml-1">{negotiableHint}</span>
                )}
              </p>
              <p className="text-sm text-[#374151] line-clamp-2 leading-snug mb-3">{listing.title}</p>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-full bg-[#1B4332] flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">
                    {listing.seller_name?.[0] ?? "V"}
                  </div>
                  <span className="text-xs text-[#6B7280] truncate max-w-[10rem]">
                    {listing.seller_name}
                  </span>
                  <SellerVerificationBadges
                    trustBadge={listing.seller_badge}
                    dlVerified={listing.seller_dl_verified}
                    einVerified={listing.seller_ein_verified}
                    phoneVerified={listing.seller_phone_verified}
                    platformListingVerified={Boolean(listing.listing_admin_verified)}
                    lang={lang}
                    size="sm"
                  />
                </div>
                <div className="flex-shrink-0 self-center">
                  <WhatsAppBadgeLocked />
                </div>
              </div>
            </div>
          </div>
        </Link>
        );
      })}
    </div>
  );
}
