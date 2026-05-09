import "server-only";

/** PostgREST embed for seller row (must match FK name on `listings.seller_id` → `users.id`). */
export const LISTING_SELLER_EMBED =
  "users!fk_listings_seller(id,display_name,avatar_url,trust_badge,dl_verified,ein_verified,ine_verified,rfc_verified,phone_verified,whatsapp_optin,created_at)";

/**
 * Load one listing for `/listing/[id]`.
 * Tries: active+embed → active bare → any status+embed → any status bare.
 * Avoids hard 404 when embed fails (wrong FK hint / legacy schema) or when status isn’t `active` yet.
 */
export async function fetchListingForDetailPage(
  supaUrl: string,
  listingId: string,
  headers: Record<string, string>
): Promise<any | null> {
  const id = encodeURIComponent(listingId);
  const base = `${supaUrl}/rest/v1/listings?id=eq.${id}`;
  const paths = [
    `${base}&status=eq.active&select=*,${LISTING_SELLER_EMBED}`,
    `${base}&status=eq.active&select=*`,
    `${base}&select=*,${LISTING_SELLER_EMBED}`,
    `${base}&select=*`,
  ];
  for (const url of paths) {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) continue;
    const rows: unknown = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0] != null) {
      return rows[0];
    }
  }
  return null;
}

/** Metadata: only columns that exist on minimal listing rows; widen if first query fails. */
export async function fetchListingMetaRow(
  supaUrl: string,
  listingId: string,
  headers: Record<string, string>
): Promise<Record<string, unknown> | null> {
  const id = encodeURIComponent(listingId);
  const selects = [
    "title_es,title_en,description_es,description_en,photo_urls,price_mxn",
    "title_es,description_es,photo_urls,price_mxn",
  ];
  for (const sel of selects) {
    const url = `${supaUrl}/rest/v1/listings?id=eq.${id}&select=${sel}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) continue;
    const rows: unknown = await res.json();
    if (Array.isArray(rows) && rows[0] && typeof rows[0] === "object") {
      return rows[0] as Record<string, unknown>;
    }
  }
  return null;
}
