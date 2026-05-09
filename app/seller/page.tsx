import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceRoleRestHeaders, getSupabaseUrl } from "@/lib/service-rest";
import Image from "next/image";
import type { Metadata } from "next";
import { langFromParam } from "@/lib/i18n-lang";
import { listingTitle } from "@/lib/listing-language";
import { formatUsdCents } from "@/lib/money";


function TrustBadge({ badge }: { badge: string }) {
  const map: Record<string, { label: string; color: string; bg: string; desc: string }> = {
    diamond: { label: "💎 Diamond",     color: "#1D4ED8", bg: "#EFF6FF", desc: "Vendedor top · 10+ reseñas" },
    gold:    { label: "🥇 Gold",        color: "#92400E", bg: "#FEF3C7", desc: "ID verificado" },
    bronze:  { label: "🥉 Bronze",      color: "#78350F", bg: "#FEF9EE", desc: "Teléfono verificado" },
    none:    { label: "✓ Verificado",   color: "#065F46", bg: "#ECFDF5", desc: "Cuenta activa" },
  };
  const b = map[badge] ?? map.none;
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ color: b.color, background: b.bg }}>
        {b.label}
      </span>
      <span className="text-xs" style={{ color: b.color }}>{b.desc}</span>
    </div>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-[#F4F0EB] rounded-2xl p-4 text-center flex-1">
      <div className="text-2xl font-bold text-[#1B4332]">{value}</div>
      <div className="text-xs text-[#6B7280] mt-0.5">{label}</div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supaUrl = getSupabaseUrl();
  const h = getServiceRoleRestHeaders();
  const res = await fetch(
    `${supaUrl}/rest/v1/users?id=eq.${params.id}&select=display_name,trust_badge`,
    { headers: h, cache: "no-store" }
  );
  const [user] = res.ok ? await res.json() : [];
  if (!user) return { title: "Seller | AISaravanna" };
  return {
    title: `${user.display_name ?? "Seller"} | AISaravanna`,
    description: `Seller profile on AISaravanna. Trust: ${user.trust_badge ?? "none"}.`,
  };
}

export default async function SellerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { lang?: string };
}) {
  const supaUrl = getSupabaseUrl();
  const h = getServiceRoleRestHeaders();
  const lang = langFromParam(searchParams?.lang);

  // Fetch seller info
  const sellerRes = await fetch(
    `${supaUrl}/rest/v1/users?id=eq.${params.id}&select=id,display_name,avatar_url,trust_badge,dl_verified,ein_verified,ine_verified,rfc_verified,phone_verified,created_at`,
    { headers: h, cache: "no-store" }
  );
  const [seller] = sellerRes.ok ? await sellerRes.json() : [];
  if (!seller) notFound();

  // Fetch seller's active listings
  const listingsRes = await fetch(
    `${supaUrl}/rest/v1/listings?seller_id=eq.${params.id}&status=eq.active&order=created_at.desc&select=id,title_es,title_en,price_mxn,category_id,condition,location_city,photo_urls,shipping_available,negotiable`,
    { headers: h, cache: "no-store" }
  );
  const listings = listingsRes.ok ? await listingsRes.json() : [];

  // Fetch sold listings count
  const soldRes = await fetch(
    `${supaUrl}/rest/v1/listings?seller_id=eq.${params.id}&status=eq.sold&select=id`,
    { headers: h, cache: "no-store" }
  );
  const sold = soldRes.ok ? await soldRes.json() : [];

  const safeListings = listings ?? [];
  const safeSold = sold ?? [];
  const memberSince = new Date(seller.created_at).getFullYear();
  const idOk = Boolean(seller.dl_verified || seller.ine_verified);
  const bizOk = Boolean(seller.ein_verified || seller.rfc_verified);
  const initials = (seller.display_name ?? "V").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-[#FDF8F1]">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#1B4332] mb-6 transition-colors">
          ← Volver al inicio
        </Link>

        {/* Seller hero card */}
        <div className="bg-white rounded-3xl border border-[#E5E0D8] p-8 mb-6">
          <div className="flex flex-col items-center text-center gap-4">

            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {initials}
            </div>

            {/* Name + badge */}
            <div>
              <h1 className="font-serif text-2xl font-bold text-[#1C1917] mb-1">
                {seller.display_name ?? "Vendedor"}
              </h1>
              <p className="text-sm text-[#6B7280] mb-3">Miembro desde {memberSince}</p>
              <TrustBadge badge={seller.trust_badge ?? "none"} />
            </div>

            {/* Verification checks */}
            <div className="flex gap-4 text-xs text-[#6B7280]">
              <span className={seller.phone_verified ? "text-[#059669]" : ""}>
                {seller.phone_verified ? "✓" : "○"} Teléfono
              </span>
              <span className={idOk ? "text-[#059669]" : ""}>
                {idOk ? "✓" : "○"} DL / ID
              </span>
              <span className={bizOk ? "text-[#059669]" : ""}>
                {bizOk ? "✓" : "○"} EIN
              </span>
            </div>

            {/* Stats row */}
            <div className="flex gap-3 w-full mt-2">
              <StatCard value={safeListings.length} label="Artículos activos" />
              <StatCard value={safeSold.length} label="Vendidos" />
              <StatCard value={memberSince} label="Miembro desde" />
            </div>
          </div>
        </div>

        {/* Buyer protection banner */}
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <p className="text-sm font-semibold text-[#065F46]">Compra Protegida</p>
            <p className="text-xs text-[#047857]">Todos los artículos de este vendedor están cubiertos por Compra Protegida.</p>
          </div>
        </div>

        {/* Active listings */}
        <div>
          <h2 className="font-serif text-xl font-bold text-[#1C1917] mb-4">
            Artículos activos
            <span className="ml-2 text-sm font-normal text-[#6B7280]">({safeListings.length})</span>
          </h2>

          {safeListings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-[#E5E0D8]">
              <div className="text-5xl mb-3">📦</div>
              <p className="text-[#6B7280]">Este vendedor no tiene artículos activos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {safeListings.map((listing: any) => (
                <Link key={listing.id} href={lang === "es" ? `/listing/${listing.id}?lang=es` : `/listing/${listing.id}`} className="group">
                  <div className="bg-white rounded-2xl overflow-hidden border border-[#E5E0D8] hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                    {/* Image */}
                    <div className="relative aspect-[4/3] bg-[#F4F0EB]">
                      {listing.photo_urls?.[0] ? (
                        <Image
                          src={listing.photo_urls[0]}
                          alt={listingTitle(listing, lang)}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-4xl text-[#E5E0D8]">
                          📦
                        </div>
                      )}
                      {listing.shipping_available && (
                        <span className="absolute bottom-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          📦 Envío
                        </span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <p className="text-base font-bold text-[#1C1917] mb-0.5">
                        {formatUsdCents(listing.price_mxn, lang)}
                        {listing.negotiable && (
                          <span className="text-xs font-normal text-[#6B7280] ml-1">
                            · {lang === "en" ? "neg." : "neg."}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#374151] line-clamp-2 leading-snug">{listingTitle(listing, lang)}</p>
                      {listing.location_city && (
                        <p className="text-[10px] text-[#9CA3AF] mt-1">📍 {listing.location_city}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
