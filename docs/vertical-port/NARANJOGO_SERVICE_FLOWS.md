# NaranjoGo → AISaravanna vertical port

Ported from **naranjogo3** (`/Users/kamleshshah/Documents/naranjoGo3`) for US/NJ marketplace **AISaravanna**.

## What was copied (Phase 1 — service verticals)

### Shared service stack (housekeeping, vet, pet care, menu-based transport)

**Lib:** `provider-services.ts`, `listing-service-menu.ts`, `service-quote*.ts`, `housekeeping-*.ts`, `booking-lifecycle.ts`, `wallet-*.ts`, `user-account-pool.ts`, and related notify/pricing modules.

**API routes:**
- `app/api/listings/[id]/service-booking/*` (state + quote send/respond/request/rebook + agreed-price)
- `app/api/listings/[id]/live-availability/`
- `app/api/bookings/checkout`, `verify-session`, `[id]/balance-checkout`, `[id]/tip-checkout`, `verify-balance-session`

**Components:** `ServiceBookingBlock`, `ServiceMenuPublic`, `ServiceMenuEditor`, `ServiceQuote*`, `HousekeepingBookingPayments`, `ListingChat` (quote-aware), `ConversationThread`.

**Migrations (run on AISaravanna Supabase):**
- `20260510120000_service_bookings_list_query_indexes.sql`
- `20260514120000_service_booking_agreed_price_and_full_connect.sql`
- `20260518150000_listings_service_menu.sql`
- `20260605120000_service_quote_gate.sql`
- `20260606120000_housekeeping_balance_tip_appointment.sql`

### US landing pages (adapted copy)

| NaranjoGo route | AISaravanna route | Signup slug |
|-----------------|-------------------|-------------|
| `/limpieza-del-hogar` | `/home-cleaning` | `limpieza` |
| `/cuidado-mascotas` | `/pet-care` | `paseador`, `pet_sitting`, `estetica_canina` |
| `/veterinaria` | `/veterinary` | `veterinaria` |
| `/transporte` | `/ride-share` | `transporte_app` (menu listings only) |

## US differences (already applied where noted)

| Mexico (NaranjoGo) | US (AISaravanna) |
|--------------------|------------------|
| Stripe `mxn` | Stripe `usd` (in copied checkout/balance/tip routes) |
| Min commission $10 MXN | Min commission $10 USD (`MIN_COMMISSION_CENTS_USD`) |
| CP 37700 / colonias SMA | NJ counties / ZIP (`lib/colonias.ts`, `us-zip.ts`) |
| OXXO wallet top-up | Card-only wallet (optional later) |
| INE/RFC verification | NJ DL / EIN (`lib/nj-provider-ids.ts`) |
| `price_mxn` column | Same column name; stores **USD cents** |

## Buyer journey (all menu verticals)

1. Landing → browse listings
2. Open listing → see **service menu**
3. Login → message provider in app
4. **Request quote** (name, phone, address) → provider **sends quote** in chat
5. Buyer **accepts** → pay **platform deposit** (Stripe USD or wallet when enabled)
6. Provider updates lifecycle → optional **balance + tip** in app (housekeeping/vet/pet)

## Phase 2 — Ride-share (NOT copied yet)

On-demand rides need the full **`lib/rides/**` + `app/api/rides/**` + `app/viaje` + `app/conductor`** stack (~100+ files), wallet hold/capture, driver onboarding, and 8+ Supabase migrations.

`/ride-share` landing exists; **dispatch UI/API is not wired** until Phase 2.

Reference manifest: see naranjogo `docs/RIDES_AI_PLAN.md`, `docs/RIDES_PROGRESS.md`.

## Remaining integration (before production)

### Database — run in this order (AISaravanna Supabase only)

If you see `relation "public.service_bookings" does not exist`, you skipped prerequisites. Run **top to bottom** in SQL Editor:

**Foundation (if not already applied):**
1. `20260502100000_bootstrap_users_listings_otp.sql` — `users`, `listings`, `otp_codes`
2. `20260420120000_listing_messaging.sql` — in-app chat tables
3. `20260416100000_service_booking_contact_gate.sql` — contact gate + booking requests
4. `20260416200000_service_bookings_paid.sql` — **creates `service_bookings`**

**Booking lifecycle + notify (required by Phase 1 port code):**
5. `20260430150000_seller_booking_paid_notify.sql`
6. `20260503120000_seller_booking_notify_claim.sql`
7. `20260503130000_buyer_booking_paid_notify.sql`
8. `20260507100000_booking_completed_review_whatsapp.sql`
9. `20260508100000_booking_ticket_phase_events.sql` — `scheduled`/`in_progress`, `ticket_code`, `booking_events`
10. `20260421100000_guarantee_claims.sql` — **required before step 11** (`seller_strike_events` FK)
11. `20260509100000_phase_c_cancellation_strikes.sql`

**Phase 1 vertical port (your 5 new files):**
12. `20260514120000_service_booking_agreed_price_and_full_connect.sql`
13. `20260518150000_listings_service_menu.sql`
14. `20260510120000_service_bookings_list_query_indexes.sql` ← indexes only; needs step 4 first
15. `20260605120000_service_quote_gate.sql`
16. `20260606120000_housekeeping_balance_tip_appointment.sql`

Quick check in SQL Editor: `SELECT to_regclass('public.service_bookings');` should return `service_bookings` before step 14.

1. ~~**Run migrations**~~ — see ordered list above.
2. ~~**Wire `/unete`**~~ — uses `PROVIDER_SERVICES` from `lib/provider-services.ts` (includes `veterinaria`).
3. ~~**Merge Stripe webhook**~~ — quote/balance/tip + booking lifecycle in `app/api/webhooks/stripe/route.ts`.
4. ~~**Fix TypeScript**~~ — `npx tsc --noEmit` clean; listing detail loads `service_menu` via `select=*`.
5. ~~**Hero / county catalog**~~ — Hero vertical pills + county chips link to `/home-cleaning`, `/pet-care`.
6. **Env:** `STRIPE_*`, optional `WALLET_ENABLED=true` for prepaid deposits (Phase 2 wallet tables not ported).

## Source repo

All patterns originate from **naranjogo3** commit `765d125` (wallet for services) on `main`.
