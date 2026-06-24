# Phase 1 roadmap — architecture matches reality

**Goal:** Ship the Home Services Concierge pillar on AISaravanna (NJ-first), with booking + NL search surfaced in UI. Tutoring and Tax Navigator stay later phases.

**Pillar priority:** Home Services → Tutoring → Tax & Benefits (farthest).

---

## Week 1 — Ship what’s built (this sprint)

| Task | Routes / files | Env vars |
|------|----------------|----------|
| Commit + push Phase 1 port | `app/home-cleaning`, `pet-care`, `veterinary`, `ride-share`, `ServiceBookingBlock`, `app/api/bookings/*`, `app/api/webhooks/stripe`, `supabase/migrations/20260430150000_*` … `20260606120000_*` | — |
| Vercel production deploy | GitHub `main` → Vercel | All vars in `.env.example` |
| Supabase migrations applied | SQL Editor (ordered list in `docs/vertical-port/NARANJOGO_SERVICE_FLOWS.md`) | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Stripe webhooks live | `POST /api/webhooks/stripe` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Smoke test booking | Listing detail → quote → deposit → balance/tip | `STRIPE_*`, optional `WALLET_ENABLED=true` |
| Concierge hints in UI | Hero `q=` → `/api/search` → `ConciergeSearchHint` on home | `OPENAI_API_KEY` (stronger NL parse) |

**Done when:** Production home search shows concierge chips; one demo listing completes deposit checkout in USD.

---

## Week 2 — Home Services Concierge (pillar 1)

| Task | Routes / files | Notes |
|------|----------------|-------|
| NL → category routing polish | `lib/search-query-parse.ts`, `/api/search` | “broken water heater”, “fuse panel”, “plumber ZIP 08854” |
| County catalog ↔ search | `CountyServiceCatalogSection`, `county_service_catalog` | Middlesex demo; A→Z labels |
| Verification narrative | Listing cards, `ListingTrustStrip`, DL/EIN badges | Emphasize vetted trades |
| Provider onboarding | `/unete`, `lib/provider-services.ts` | HVAC, plumbing, electrical, handyman slugs |
| Listing menus for trades | `/profile/listing/[id]/menu`, `ServiceMenuEditor` | Starter menus per vertical |
| Post-search CTA | `ConciergeSearchHint` → vertical landings | `/home-cleaning` first |

**Done when:** A resident can search in plain English, see interpreted service/time/budget, open a verified listing, request quote, pay deposit.

---

## Week 3 — Harden + measure

| Task | Routes / files | Env vars |
|------|----------------|----------|
| Booking reminders cron | `/api/cron/send-booking-reminders` | `CRON_SECRET` (Vercel cron in `vercel.json`) |
| WhatsApp booking notify | Twilio paths in webhook + notify libs | `TWILIO_*` |
| Connect payouts for sellers | `/api/stripe/connect/onboarding` | `STRIPE_CONNECT_*` |
| Hybrid search quality | Embeddings on listings, `/api/search` dense layer | `OPENAI_API_KEY` |
| Error monitoring | Vercel logs, Stripe dashboard | — |
| FAQ + trust copy | `/faq` | Align “escrow” with actual Stripe behavior |

**Done when:** 5+ real provider listings in Middlesex; ≥1 paid booking end-to-end without manual DB edits.

---

## Week 4 — Concierge v1 (pre-calendar)

| Task | Routes / files | Notes |
|------|----------------|-------|
| Replace concierge stub | `/api/concierge/request` | Return same parse as search; link to top 3 listings |
| Hero → auto county/ZIP | `Hero.tsx`, `/api/geo/zip` | Already partial; tighten UX |
| “Near me” + distance | `ListingGrid`, `lib/listing-distance.ts` | Miles badge on cards |
| Admin verify queue | `/admin`, `/api/admin/listing-queue` | Approve service verticals |
| Optional: ml-service | `ml-service/`, `/api/ml/*` | Image categorize for `/+ Sell` — not blocking |

**Done when:** `/api/concierge/request` is no longer `stub: true` for read path; UI deep-links to listing chat with pre-filled quote request.

---

## Later (not Phase 1)

| Track | Status | Start after |
|-------|--------|-------------|
| **AI Tutoring** | Category + search hints only | Home Services stable |
| **Tax & Benefits Navigator** | Not started (no routes) | Tutoring MVP or explicit biz decision |
| **Ride-share dispatch** | Landing only; no `lib/rides` | Phase 2 doc in `NARANJOGO_SERVICE_FLOWS.md` |
| **PA / MD / DE corridor** | NJ counties only | Geo epic in `INTERNAL_MARKET_STRATEGY_ALIGNMENT.md` |
| **Stripe Identity** | Manual DL/EIN today | Trust automation epic |

---

## Environment checklist (production)

| Variable | Required for |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | All data |
| `SUPABASE_SERVICE_ROLE_KEY` | OTP, search, bookings |
| `JWT_SECRET` | Session cookie |
| `STRIPE_SECRET_KEY` | Checkout |
| `STRIPE_WEBHOOK_SECRET` | Booking lifecycle |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client checkout |
| `OPENAI_API_KEY` | NL search + concierge parse |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | OTP + booking WhatsApp |
| `NEXT_PUBLIC_APP_URL` | Server-side fetch to `/api/search` |
| `WALLET_ENABLED` | Optional prepaid deposits (Phase 2 tables) |

---

## Quick verification commands

```bash
npx tsc --noEmit
npm run build
```

Search smoke (local):

```bash
curl -s "http://localhost:3000/api/search?q=house+cleaning+Saturday+under+%24120&category=services" | jq '{mode, concierge, searchCategoryHint, total}'
```

---

*Update this file when epics ship or env requirements change.*
