/**
 * Automated E2E checks: taxi/service quote → accept → paid booking lifecycle → balance.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET,
 * and `npm run dev` on port 3006 (or MESSAGING_TEST_BASE_URL).
 *
 * Stripe deposit is simulated via DB insert (webhook step is documented for manual QA).
 *
 * Run: npm run test:e2e
 * Smoke (no Supabase): npm run test:e2e:smoke
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

function loadDotenv() {
  for (const name of [".env.local", ".env"]) {
    const p = join(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf-8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

async function jwtFor(userId: string): Promise<string> {
  const raw = process.env.JWT_SECRET?.trim();
  const secret = new TextEncoder().encode(
    raw && raw.length > 0 ? raw : "tianguis_dev_secret_change_in_production",
  );
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

const FETCH_MS = 20_000;

async function fetchJson(
  base: string,
  path: string,
  opts: RequestInit & { cookieJwt?: string } = {},
): Promise<{ ok: boolean; status: number; data: unknown; text?: string }> {
  const { cookieJwt, ...init } = opts;
  const headers = new Headers(init.headers);
  if (cookieJwt) headers.set("Cookie", `tianguis_token=${cookieJwt}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(`${base}${path}`, { ...init, headers, signal: ctrl.signal });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { _raw: text.slice(0, 500) };
    }
    return { ok: res.ok, status: res.status, data, text };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(base: string, path: string): Promise<{ ok: boolean; status: number; html: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(`${base}${path}`, { signal: ctrl.signal });
    const html = await res.text();
    return { ok: res.ok, status: res.status, html };
  } finally {
    clearTimeout(timer);
  }
}

async function discoverDevBase(explicit: string | undefined): Promise<string> {
  if (explicit) return explicit.replace(/\/$/, "");
  for (const port of [3006, 3000, 3001]) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${base}/api/conversations/inbox`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 401) return base;
    } catch {
      /* next */
    }
  }
  return "http://127.0.0.1:3006";
}

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

function ok(msg: string) {
  console.log("  ✓", msg);
}

type TaxiListing = {
  id: string;
  seller_id: string;
  title_es: string;
  service_menu: { items?: { sku: string; price_mxn_cents: number }[] };
};

async function findTaxiListing(supabase: SupabaseClient): Promise<TaxiListing | null> {
  const { data } = await supabase
    .from("listings")
    .select("id,seller_id,title_es,service_menu")
    .eq("status", "active")
    .ilike("title_es", "Transporte / Taxi%")
    .not("service_menu", "is", null)
    .limit(5);
  const row = (data ?? []).find(
    (r) =>
      r.seller_id &&
      Array.isArray((r.service_menu as TaxiListing["service_menu"])?.items) &&
      ((r.service_menu as TaxiListing["service_menu"]).items?.length ?? 0) > 0,
  );
  return row as TaxiListing | null;
}

async function uiSmoke(base: string, listingId?: string) {
  console.log("\n— UI smoke —");
  const ride = await fetchHtml(base, "/ride-share");
  if (!ride.ok) fail(`/ride-share returned ${ride.status}`);
  if (!ride.html.includes("Middlesex")) fail("/ride-share missing Middlesex copy");
  if (ride.html.includes('href="/viaje"') || ride.html.includes("href='/viaje'")) {
    fail("/ride-share still links to /viaje");
  }
  ok("/ride-share — Middlesex copy, no /viaje link");

  if (listingId) {
    const page = await fetchHtml(base, `/listing/${listingId}`);
    if (!page.ok) fail(`/listing/${listingId} returned ${page.status}`);
    if (!page.html.includes("Menú de servicios") && !page.html.includes("Service menu")) {
      fail("Listing page missing service menu section");
    }
    ok(`Listing ${listingId.slice(0, 8)}… — menu section present`);
  }
}

async function smokeOnly(base: string) {
  console.log(`E2E smoke → ${base}`);
  try {
    const ping = await fetchJson(base, "/api/conversations/inbox");
    if (ping.status !== 401) fail(`Expected 401 on inbox, got ${ping.status}`);
  } catch {
    fail(`Cannot reach ${base} — run npm run dev`);
  }
  ok("API auth gate");
  await uiSmoke(base);
  console.log("\nOK — E2E smoke passed (no DB). Run full test with Supabase env.");
}

async function cleanup(
  supabase: SupabaseClient,
  opts: {
    bookingId?: string;
    listingId: string;
    buyerId: string;
    conversationId?: string;
  },
) {
  if (opts.bookingId) {
    await supabase.from("service_booking_events").delete().eq("booking_id", opts.bookingId);
    await supabase.from("service_bookings").delete().eq("id", opts.bookingId);
  }
  await supabase
    .from("listing_service_contact_gate")
    .delete()
    .eq("listing_id", opts.listingId)
    .eq("buyer_id", opts.buyerId);
  if (opts.conversationId) {
    await supabase.from("listing_messages").delete().eq("conversation_id", opts.conversationId);
    await supabase.from("listing_conversations").delete().eq("id", opts.conversationId);
  }
}

async function main() {
  loadDotenv();
  const base = await discoverDevBase(process.env.MESSAGING_TEST_BASE_URL?.replace(/\/$/, ""));
  const smoke = process.argv.includes("--smoke");
  if (smoke) {
    await smokeOnly(base);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use --smoke for UI-only.");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  console.log(`Service booking E2E → ${base}`);

  const listing = await findTaxiListing(supabase);
  if (!listing) {
    console.warn("WARN: No seeded taxi listing (Transporte / Taxi + service_menu).");
    console.warn("      Run supabase/seed-middlesex-taxi-drivers.sql first.");
    fail("No taxi listing in DB for E2E");
  }

  const listingId = listing.id;
  const sellerId = String(listing.seller_id);
  const menuItems = listing.service_menu.items ?? [];
  const sku = menuItems.find((i) => i.sku.includes("ewr") || i.sku.includes("airport"))?.sku ?? menuItems[0]?.sku;
  if (!sku) fail("Taxi listing menu has no items");

  const buyerId = randomUUID();
  const buyerToken = await jwtFor(buyerId);
  const sellerToken = await jwtFor(sellerId);

  ok(`Listing: ${listing.title_es.slice(0, 50)}…`);
  ok(`Menu SKU: ${sku}`);

  await uiSmoke(base, listingId);

  const preferredAt = new Date(Date.now() + 48 * 3600_000).toISOString();
  const buyerContact = {
    firstName: "E2E",
    lastName: "Tester",
    contactPhone: "15555550998",
    whatsappPhone: null,
    serviceAddress: "123 Main St, Edison, NJ 08817",
    preferredAt,
  };

  console.log("\n— Quote request (buyer) —");
  const req = await fetchJson(base, `/api/listings/${listingId}/service-booking/quote/request`, {
    method: "POST",
    cookieJwt: buyerToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cartLines: [{ sku, qty: 1 }],
      lang: "en",
      buyerContact,
      buyerNotes: "E2E automated test — safe to delete",
    }),
  });
  if (!req.ok) fail(`quote/request: ${req.status} ${JSON.stringify(req.data)}`);
  ok("Buyer quote request accepted");

  const convRes = await fetchJson(
    base,
    `/api/conversations?listingId=${encodeURIComponent(listingId)}`,
    { cookieJwt: buyerToken },
  );
  const conversations = (convRes.data as { conversations?: { id: string }[] })?.conversations ?? [];
  const conversationId = conversations[0]?.id;
  if (!conversationId) fail("No conversation after quote request");

  const { data: gateBefore } = await supabase
    .from("listing_service_contact_gate")
    .select("quote_status,quote_line_items")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (!gateBefore?.quote_line_items) fail("DB: contact gate missing quote_line_items after request");
  ok("DB: contact gate + line items");

  const lineItems = gateBefore.quote_line_items as { sku: string; qty: number; price_mxn_cents: number }[];
  const agreedTotal = lineItems.reduce((s, it) => s + it.price_mxn_cents * (it.qty ?? 1), 0);

  console.log("\n— Official quote (seller) —");
  const send = await fetchJson(base, `/api/listings/${listingId}/service-booking/quote/send`, {
    method: "POST",
    cookieJwt: sellerToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buyerId,
      agreedSubtotalMxnCents: agreedTotal,
      quoteLineItems: lineItems,
      lang: "en",
    }),
  });
  if (!send.ok) fail(`quote/send: ${send.status} ${JSON.stringify(send.data)}`);

  const { data: gatePending } = await supabase
    .from("listing_service_contact_gate")
    .select("quote_status,agreed_subtotal_mxn_cents")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (gatePending?.quote_status !== "pending") fail(`DB: expected quote_status pending, got ${gatePending?.quote_status}`);
  ok(`DB: quote pending ($${(agreedTotal / 100).toFixed(2)} USD)`);

  console.log("\n— Accept quote (buyer) —");
  const accept = await fetchJson(base, `/api/listings/${listingId}/service-booking/quote/respond`, {
    method: "POST",
    cookieJwt: buyerToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "accept", lang: "en" }),
  });
  if (!accept.ok) fail(`quote/respond: ${accept.status} ${JSON.stringify(accept.data)}`);

  const { data: gateAccepted } = await supabase
    .from("listing_service_contact_gate")
    .select("quote_status")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (gateAccepted?.quote_status !== "accepted") fail(`DB: expected accepted, got ${gateAccepted?.quote_status}`);
  ok("DB: quote accepted");

  console.log("\n— Simulated deposit (paid booking row) —");
  console.log("  (Manual QA: Stripe test card 4242… + stripe listen --forward-to localhost:3006/api/webhooks/stripe)");

  const commissionCents = Math.max(1000, Math.round(agreedTotal * 0.1));
  const bookingId = randomUUID();
  const { error: insErr } = await supabase.from("service_bookings").insert({
    id: bookingId,
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: sellerId,
    commission_amount_cents: commissionCents,
    commission_pct: 10,
    pricing_base_mxn_cents: agreedTotal,
    payment_status: "paid",
    paid_at: new Date().toISOString(),
    status: "confirmed",
    stripe_checkout_session_id: `e2e_test_${bookingId}`,
    seller_phone_snapshot: "15555550201",
    contact_revealed_at: new Date().toISOString(),
    note: "E2E automated test booking",
  });
  if (insErr) fail(`Insert booking: ${insErr.message}`);

  await supabase
    .from("service_bookings")
    .update({ ticket_code: `E2E-${bookingId.slice(0, 8).toUpperCase()}` })
    .eq("id", bookingId);
  ok(`DB: paid booking ${bookingId.slice(0, 8)}…`);

  console.log("\n— Seller lifecycle —");
  const appt = new Date(Date.now() + 72 * 3600_000).toISOString();
  for (const [status, body] of [
    ["scheduled", { status: "scheduled", appointmentAt: appt }],
    ["in_progress", { status: "in_progress" }],
    ["completed", { status: "completed" }],
  ] as const) {
    const patch = await fetchJson(base, `/api/bookings/${bookingId}`, {
      method: "PATCH",
      cookieJwt: sellerToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!patch.ok) fail(`PATCH ${status}: ${patch.status} ${JSON.stringify(patch.data)}`);

    const { data: row } = await supabase
      .from("service_bookings")
      .select("status,appointment_at,balance_due_mxn_cents,balance_payment_status")
      .eq("id", bookingId)
      .maybeSingle();
    if (row?.status !== status) fail(`DB: expected status ${status}, got ${row?.status}`);
    ok(`Lifecycle → ${status}`);
    if (status === "scheduled" && !row?.appointment_at) fail("DB: appointment_at not set");
    if (status === "completed") {
      const expectedBalance = Math.max(0, agreedTotal - commissionCents);
      if ((row?.balance_due_mxn_cents ?? 0) !== expectedBalance) {
        fail(`DB: balance_due expected ${expectedBalance}, got ${row?.balance_due_mxn_cents}`);
      }
      if (expectedBalance >= 100 && row?.balance_payment_status !== "pending") {
        fail(`DB: balance_payment_status expected pending, got ${row?.balance_payment_status}`);
      }
      ok(`DB: balance due $${(expectedBalance / 100).toFixed(2)} USD (pending)`);
    }
  }

  console.log("\n— Buyer API after completion —");
  const getBooking = await fetchJson(base, `/api/bookings/${bookingId}`, { cookieJwt: buyerToken });
  if (!getBooking.ok) fail(`GET booking: ${getBooking.status}`);
  const b = getBooking.data as {
    status?: string;
    balanceDueMxnCents?: number;
    isBuyer?: boolean;
  };
  if (b.status !== "completed") fail(`API: buyer status ${b.status}`);
  if (!b.isBuyer) fail("API: isBuyer should be true");
  if ((b.balanceDueMxnCents ?? 0) < 100) fail("API: balanceDueMxnCents missing after complete");
  ok("Buyer GET /api/bookings/:id — completed + balance due");

  const sellerDash = await fetchHtml(base, "/seller-bookings");
  if (!sellerDash.ok) fail(`/seller-bookings returned ${sellerDash.status}`);
  ok("/seller-bookings page loads");

  console.log("\n— Cleanup —");
  await cleanup(supabase, { bookingId, listingId, buyerId, conversationId });
  ok("Test rows removed");

  console.log("\nOK — service booking E2E passed:");
  console.log(`  listing=${listingId}`);
  console.log(`  sku=${sku} agreed=$${(agreedTotal / 100).toFixed(2)}`);
  console.log("\nManual only: Stripe deposit UI + balance/tip checkout in browser.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
