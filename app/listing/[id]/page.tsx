import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ListingChat from "@/components/ListingChat";
import ServiceBookingBlock from "@/components/ServiceBookingBlock";
import WhatsAppCTA from "@/components/WhatsAppCTA";
import SellerReviews, { RatingSummary } from "@/components/SellerReviews";
import ReportButton from "@/components/ReportButton";
import GuaranteeBadge from "@/components/GuaranteeBadge";
import FavoriteButton from "@/components/FavoriteButton";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { isServicesListing } from "@/lib/listing-category";
import { getServiceRoleRestHeaders, getSupabaseUrl } from "@/lib/service-rest";
import { SellerVerificationBadges } from "@/components/SellerVerificationBadges";
import { embeddedSellerRow, verificationPropsFromSellerRow } from "@/lib/seller-trust-display";
import { langFromParam } from "@/lib/i18n-lang";
import ListingPhotoGallery from "@/components/ListingPhotoGallery";
import { listingTitle, listingDescription } from "@/lib/listing-language";
import { formatUsdCents } from "@/lib/money";
import { fetchListingForDetailPage, fetchListingMetaRow } from "@/lib/listing-detail-fetch";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supaUrl = getSupabaseUrl();
  const h = getServiceRoleRestHeaders();
  const data = await fetchListingMetaRow(supaUrl, params.id, h);
  if (!data) return { title: "Listing not found | AISaravanna" };

  const headTitle = listingTitle(data as Parameters<typeof listingTitle>[0], "en");
  const headDesc = listingDescription(data as Parameters<typeof listingDescription>[0], "en");
  const priceMxn = Number((data as { price_mxn?: unknown }).price_mxn);
  const price = formatUsdCents(Number.isFinite(priceMxn) ? priceMxn : 0, "en");
  return {
    title: `${headTitle} — ${price} | AISaravanna`,
    description: (headDesc || headTitle).slice(0, 160),
    openGraph: {
      title: headTitle,
      description: headDesc ?? "",
      images: (() => {
        const photos = (data as { photo_urls?: unknown }).photo_urls;
        const first = Array.isArray(photos) && typeof photos[0] === "string" ? photos[0] : null;
        return first ? [{ url: first, width: 800, height: 600 }] : [];
      })(),
    },
  };
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { chat?: string; lang?: string };
}) {
  const supaUrl = getSupabaseUrl();
  const h = { ...getServiceRoleRestHeaders(), "Content-Type": "application/json" };
  const listing = await fetchListingForDetailPage(supaUrl, params.id, h);
  if (!listing) notFound();

  const listingActive = String(listing.status ?? "") === "active";

  fetch(`${supaUrl}/rest/v1/rpc/increment_view_count`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ listing_id: params.id }),
  }).catch(() => {});

  const seller = embeddedSellerRow(listing.users as Record<string, unknown> | Record<string, unknown>[] | null | undefined) as
    | {
        id?: string;
        display_name?: string | null;
        created_at?: string;
      }
    | null;
  const sellerId = listing.seller_id ?? seller?.id;

  let reviewCount = 0;
  let avgRating = 0;
  if (sellerId) {
    const revRes = await fetch(
      `${supaUrl}/rest/v1/seller_reviews?seller_id=eq.${sellerId}&select=rating`,
      { headers: h, cache: "no-store" }
    );
    const revRows: { rating: number }[] = revRes.ok ? await revRes.json() : [];
    reviewCount = revRows.length;
    avgRating =
      reviewCount > 0
        ? Math.round((revRows.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
        : 0;
  }

  const listingLang = langFromParam(searchParams?.lang);
  const displayTitle = listingTitle(listing, listingLang);
  const displayDescription = listingDescription(listing, listingLang);
  const price = formatUsdCents(listing.price_mxn, listingLang);
  const isServiceListing = isServicesListing(listing);
  const sellerTrust = verificationPropsFromSellerRow(
    listing.users as Parameters<typeof verificationPropsFromSellerRow>[0]
  );

  return (
    <main className="min-h-screen bg-[#FDF8F1]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {!listingActive && (
          <div
            className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            {listingLang === "en"
              ? "This listing is not published for booking (status is not active). You can still view the details; contact features may be limited."
              : "Este anuncio no está publicado para reservas (el estado no es activo). Puedes ver los detalles; algunas acciones pueden estar limitadas."}
          </div>
        )}
        <ListingPhotoGallery photos={Array.isArray(listing.photo_urls) ? listing.photo_urls : []} title={displayTitle} />
        <div className="flex items-start justify-between mb-3">
          <span className="text-3xl font-bold text-[#1B4332]">{price}</span>
          {listing.negotiable && (
            <span className="text-sm text-[#6B7280] italic">
              {listingLang === "en" ? "Negotiable" : "Negociable"}
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-xl font-semibold text-[#1C1917] flex-1 min-w-0">{displayTitle}</h1>
          <FavoriteButton listingId={params.id} />
        </div>
        {isServiceListing && listing.package_session_count >= 2 && listing.package_total_price_mxn > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>{listingLang === "en" ? "Approved package:" : "Paquete aprobado:"}</strong>{" "}
            {listing.package_session_count}{" "}
            {listingLang === "en" ? "sessions for" : "sesiones por"}{" "}
            {formatUsdCents(listing.package_total_price_mxn, listingLang)}{" "}
            {listingLang === "en"
              ? "total (platform fee is calculated on this amount when you book)."
              : "en total (la tarifa de plataforma se calcula sobre este monto al reservar)."}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-6">
          {listing.shipping_available && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              {listingLang === "en" ? "Shipping available" : "Envío disponible"}
            </span>
          )}
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#F4F0EB] text-[#6B7280]">{listing.condition}</span>
          {listing.location_city && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#F4F0EB] text-[#6B7280]">{listing.location_city}</span>
          )}
        </div>
        {/* WhatsApp CTA — hero button (contact gate + commission same as services) */}
        <div className="mb-6">
          <WhatsAppCTA listingId={params.id} />
          <p className="text-center text-xs text-[#6B7280] mt-2">
            {isServiceListing
              ? listingLang === "en"
                ? "Chat first, pay the fee, then get the provider’s WhatsApp."
                : "Platica primero, paga la tarifa y recibe el WhatsApp del proveedor"
              : listingLang === "en"
                ? "Message in the app, pay the connection fee, then unlock the seller’s WhatsApp."
                : "Escribe por la app, paga la tarifa de conexión y desbloquea el WhatsApp del vendedor"}
          </p>
        </div>

        {!isServiceListing && (
          <div className="mb-6 space-y-2">
            <AddToCartButton
              listingId={params.id}
              titleEs={displayTitle}
              priceMxnCents={Number(listing.price_mxn) || 0}
            />
            <p className="text-xs text-[#6B7280] text-center">
              {listingLang === "en"
                ? "Or use the cart: you’ll see commission (admin), VAT, and total before paying. With Stripe Connect enabled for sellers, subtotal goes to the seller; otherwise the charge is to the platform (manual settlement)."
                : "O compra por carrito: verás comisión (admin), IVA y total antes de pagar. Con Stripe Connect activo para vendedores, el subtotal va al vendedor; si no, el cargo es a la plataforma (reparto manual)."}
            </p>
          </div>
        )}

        {displayDescription ? <p className="text-[#374151] leading-relaxed mb-6">{displayDescription}</p> : null}

        {/* Payment methods section — hidden until commission collection is enabled via Stripe */}

        {sellerId && (
          <Link href={`/seller/${sellerId}`} className="block hover:opacity-90 transition-opacity">
            <div className="bg-[#F4F0EB] rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#1B4332] flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                {seller?.display_name?.[0] ?? "V"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-semibold text-sm">
                    {seller?.display_name ?? (listingLang === "en" ? "Seller" : "Vendedor")}
                  </span>
                  <SellerVerificationBadges
                    trustBadge={sellerTrust.trustBadge}
                    dlVerified={sellerTrust.dlVerified}
                    einVerified={sellerTrust.einVerified}
                    phoneVerified={sellerTrust.phoneVerified}
                    platformListingVerified={Boolean(listing.is_verified)}
                    lang={listingLang}
                    size="md"
                  />
                  {reviewCount > 0 && <RatingSummary average={avgRating} total={reviewCount} />}
                </div>
                <span className="text-xs text-[#6B7280]">
                  {listingLang === "en" ? "Member since" : "Miembro desde"}{" "}
                  {seller?.created_at ? new Date(seller.created_at).getFullYear() : "—"}
                </span>
              </div>
            </div>
          </Link>
        )}
        <div className="flex flex-col gap-3">
          <ListingChat listingId={params.id} initialConversationId={searchParams?.chat} />
          <div id="booking-section">
            <ServiceBookingBlock
              listingId={params.id}
              isService={isServiceListing}
              sellerId={listing.seller_id ?? null}
            />
          </div>
        </div>

        <div className="mt-6">
          <GuaranteeBadge />
        </div>

        {sellerId && (
          <div className="mt-8">
            <h2 className="font-serif text-xl font-bold text-[#1C1917] mb-4">
              {listingLang === "en" ? "Seller reviews" : "Reseñas del vendedor"}
              {reviewCount > 0 && <span className="ml-2 text-sm font-normal text-[#6B7280]">({reviewCount})</span>}
            </h2>
            <SellerReviews sellerId={sellerId} />
          </div>
        )}

        {/* Report */}
        <div className="mt-8 pt-6 border-t border-[#E5E0D8] flex justify-center">
          <ReportButton listingId={params.id} sellerId={sellerId} />
        </div>
      </div>
    </main>
  );
}
