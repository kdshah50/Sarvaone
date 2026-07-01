/*
  Phase 1.5 — verified taxi / ride drivers in Middlesex County, NJ.
  Menu + quote + deposit flow (no live dispatch).

  PREREQUISITE: Bootstrap migrations applied (users, listings, service_menu column).

  RUN: Supabase → SQL Editor → paste → Run.

  Browse: http://localhost:3000/?category=services&q=Transporte%20%2F%20Taxi&colonia=middlesex
  Landing: http://localhost:3000/ride-share

  CLEANUP:
    DELETE FROM public.listings WHERE title_es LIKE 'Transporte / Taxi —%' AND description_es LIKE '%(demo taxi Middlesex)%';
    DELETE FROM public.users WHERE phone BETWEEN '15555550201' AND '15555550208';
*/

-- Demo driver accounts (public.users only — sign in via OTP with these phones in dev if needed)
INSERT INTO public.users (phone, display_name, trust_badge, phone_verified)
VALUES
  ('15555550201', 'Edison Express Car', 'silver', true),
  ('15555550202', 'Middlesex Airport Link', 'silver', true),
  ('15555550203', 'Rutgers Rides NB', 'bronze', true),
  ('15555550204', 'Metuchen Medical Taxi', 'silver', true),
  ('15555550205', 'Piscataway Shuttle Co', 'bronze', true),
  ('15555550206', 'Desi Community Rides', 'silver', true),
  ('15555550207', 'JFK Express NJ', 'silver', true),
  ('15555550208', 'RWJ Hospital Shuttle', 'bronze', true)
ON CONFLICT (phone) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  trust_badge = EXCLUDED.trust_badge,
  phone_verified = EXCLUDED.phone_verified;

-- Shared disclaimer (matches lib/listing-service-menu.ts DEFAULT_TAXI_RIDE_*)
-- Prices in price_mxn_cents / service_menu are USD cents (legacy column name).

INSERT INTO public.listings (
  seller_id, title_es, title_en, description_es, description_en,
  price_mxn, category_id, condition, status, is_verified,
  location_city, location_state, zip_code, location_lat, location_lng,
  shipping_available, negotiable, photo_urls, payment_methods, expires_at,
  service_menu
)
SELECT
  u.id,
  v.title_es,
  v.title_en,
  v.description_es,
  v.description_en,
  v.price_mxn,
  'services',
  'good',
  'active',
  TRUE,
  v.location_city,
  'New Jersey',
  v.zip_code,
  v.lat,
  v.lng,
  FALSE,
  TRUE,
  '[]'::jsonb,
  ARRAY['stripe', 'whatsapp']::text[],
  now() + interval '120 days',
  v.service_menu
FROM (VALUES
  (
    '15555550201',
    'Transporte / Taxi — Edison Express Car — Edison, NJ',
    'Ride / Taxi — Edison Express Car — Edison, NJ',
    'Conductor verificado en Edison. Especialista EWR y viajes locales. Menú con tarifas fijas — cotización en chat, depósito en app. (demo taxi Middlesex)',
    'Verified Edison driver. EWR specialist and local runs. Fixed-fare menu — quote in chat, deposit in app. (demo taxi Middlesex)',
    5800,
    'Edison, NJ',
    '08817',
    40.5182,
    -74.3895,
    '{"version":1,"currency":"USD","disclaimer_es":"El precio puede variar por tráfico, horario, paradas extra o espera adicional. Se confirma en mensaje antes del viaje.","disclaimer_en":"Price may vary with traffic, time of day, extra stops, or additional wait time. Confirmed by message before the ride.","items":[{"sku":"wait_time_hour","name_es":"Tiempo de espera (por hora)","name_en":"Wait time (per hour)","price_mxn_cents":3500},{"sku":"ewr_airport","name_es":"Aeropuerto Newark (EWR) — desde Edison","name_en":"Newark Liberty (EWR) — from Edison","price_mxn_cents":5500},{"sku":"edison_local","name_es":"Edison — viaje local (solo ida)","name_en":"Edison local trip (one way)","price_mxn_cents":2800},{"sku":"edison_new_brunswick","name_es":"Edison ↔ New Brunswick (solo ida)","name_en":"Edison ↔ New Brunswick (one way)","price_mxn_cents":3800},{"sku":"hospital_jfk_med","name_es":"JFK Medical Center (Edison) — solo ida","name_en":"JFK Medical Center (Edison) — one way","price_mxn_cents":3000},{"sku":"other_custom","name_es":"Otro trayecto (cotizar en chat)","name_en":"Other route (quote in chat)","price_mxn_cents":3500}]}'::jsonb
  ),
  (
    '15555550202',
    'Transporte / Taxi — Middlesex Airport Link — Woodbridge, NJ',
    'Ride / Taxi — Middlesex Airport Link — Woodbridge, NJ',
    'Woodbridge → EWR, JFK y LGA. Tarifas publicadas, reserva con anticipación. (demo taxi Middlesex)',
    'Woodbridge to EWR, JFK, and LGA. Published fares, book ahead. (demo taxi Middlesex)',
    5800,
    'Woodbridge Township, NJ',
    '07095',
    40.557,
    -74.285,
    '{"version":1,"currency":"USD","disclaimer_es":"El precio puede variar por tráfico, horario, paradas extra o espera adicional. Se confirma en mensaje antes del viaje.","disclaimer_en":"Price may vary with traffic, time of day, extra stops, or additional wait time. Confirmed by message before the ride.","items":[{"sku":"ewr_airport","name_es":"Aeropuerto Newark (EWR) — desde Woodbridge","name_en":"Newark Liberty (EWR) — from Woodbridge","price_mxn_cents":5200},{"sku":"jfk_airport","name_es":"Aeropuerto JFK — desde Woodbridge","name_en":"JFK Airport — from Woodbridge","price_mxn_cents":12800},{"sku":"lga_airport","name_es":"Aeropuerto LaGuardia (LGA) — desde Woodbridge","name_en":"LaGuardia (LGA) — from Woodbridge","price_mxn_cents":11800},{"sku":"wait_time_hour","name_es":"Tiempo de espera (por hora)","name_en":"Wait time (per hour)","price_mxn_cents":3500},{"sku":"round_trip_wait","name_es":"Ida y vuelta + 1 h de espera","name_en":"Round trip + 1 hr wait","price_mxn_cents":9000},{"sku":"other_custom","name_es":"Otro trayecto (cotizar en chat)","name_en":"Other route (quote in chat)","price_mxn_cents":3500}]}'::jsonb
  ),
  (
    '15555550203',
    'Transporte / Taxi — Rutgers Rides NB — New Brunswick, NJ',
    'Ride / Taxi — Rutgers Rides NB — New Brunswick, NJ',
    'Viajes Rutgers, estación NJ Transit, y trayectos Edison–New Brunswick. (demo taxi Middlesex)',
    'Rutgers campus, NJ Transit station, Edison–New Brunswick runs. (demo taxi Middlesex)',
    3800,
    'New Brunswick, NJ',
    '08901',
    40.4862,
    -74.4518,
    '{"version":1,"currency":"USD","disclaimer_es":"El precio puede variar por tráfico, horario, paradas extra o espera adicional. Se confirma en mensaje antes del viaje.","disclaimer_en":"Price may vary with traffic, time of day, extra stops, or additional wait time. Confirmed by message before the ride.","items":[{"sku":"edison_new_brunswick","name_es":"Edison ↔ New Brunswick (solo ida)","name_en":"Edison ↔ New Brunswick (one way)","price_mxn_cents":3800},{"sku":"ewr_airport","name_es":"Aeropuerto Newark (EWR) — desde New Brunswick","name_en":"Newark Liberty (EWR) — from New Brunswick","price_mxn_cents":6200},{"sku":"shopping_errands","name_es":"Compras / mandados (local, solo ida)","name_en":"Shopping / errands (local, one way)","price_mxn_cents":3000},{"sku":"wait_time_hour","name_es":"Tiempo de espera (por hora)","name_en":"Wait time (per hour)","price_mxn_cents":3500},{"sku":"other_custom","name_es":"Otro trayecto (cotizar en chat)","name_en":"Other route (quote in chat)","price_mxn_cents":3500}]}'::jsonb
  ),
  (
    '15555550204',
    'Transporte / Taxi — Metuchen Medical Taxi — Metuchen, NJ',
    'Ride / Taxi — Metuchen Medical Taxi — Metuchen, NJ',
    'Traslados a citas médicas, RWJ, JFK Medical Edison, centros de rehabilitación. (demo taxi Middlesex)',
    'Medical appointment runs — RWJ, JFK Medical Edison, rehab centers. (demo taxi Middlesex)',
    3200,
    'Metuchen, NJ',
    '08840',
    40.5432,
    -74.3632,
    '{"version":1,"currency":"USD","disclaimer_es":"El precio puede variar por tráfico, horario, paradas extra o espera adicional. Se confirma en mensaje antes del viaje.","disclaimer_en":"Price may vary with traffic, time of day, extra stops, or additional wait time. Confirmed by message before the ride.","items":[{"sku":"hospital_rwj","name_es":"RWJ University Hospital (New Brunswick) — solo ida","name_en":"RWJ University Hospital (New Brunswick) — one way","price_mxn_cents":3200},{"sku":"hospital_jfk_med","name_es":"JFK Medical Center (Edison) — solo ida","name_en":"JFK Medical Center (Edison) — one way","price_mxn_cents":2800},{"sku":"wait_time_hour","name_es":"Tiempo de espera (por hora)","name_en":"Wait time (per hour)","price_mxn_cents":3500},{"sku":"round_trip_wait","name_es":"Ida y vuelta + 1 h de espera (cita médica)","name_en":"Round trip + 1 hr wait (medical appointment)","price_mxn_cents":7500},{"sku":"other_custom","name_es":"Otro trayecto (cotizar en chat)","name_en":"Other route (quote in chat)","price_mxn_cents":3500}]}'::jsonb
  ),
  (
    '15555550205',
    'Transporte / Taxi — Piscataway Shuttle Co — Piscataway, NJ',
    'Ride / Taxi — Piscataway Shuttle Co — Piscataway, NJ',
    'Shuttle Piscataway → EWR y LGA. Sedán limpio, reserva con 24 h. (demo taxi Middlesex)',
    'Piscataway shuttle to EWR and LGA. Clean sedan, 24h booking. (demo taxi Middlesex)',
    5800,
    'Piscataway, NJ',
    '08854',
    40.499,
    -74.464,
    '{"version":1,"currency":"USD","disclaimer_es":"El precio puede variar por tráfico, horario, paradas extra o espera adicional. Se confirma en mensaje antes del viaje.","disclaimer_en":"Price may vary with traffic, time of day, extra stops, or additional wait time. Confirmed by message before the ride.","items":[{"sku":"ewr_airport","name_es":"Aeropuerto Newark (EWR) — desde Piscataway","name_en":"Newark Liberty (EWR) — from Piscataway","price_mxn_cents":5600},{"sku":"lga_airport","name_es":"Aeropuerto LaGuardia (LGA) — desde Piscataway","name_en":"LaGuardia (LGA) — from Piscataway","price_mxn_cents":11200},{"sku":"wait_time_hour","name_es":"Tiempo de espera (por hora)","name_en":"Wait time (per hour)","price_mxn_cents":3500},{"sku":"shopping_errands","name_es":"Compras / mandados (local, solo ida)","name_en":"Shopping / errands (local, one way)","price_mxn_cents":3000},{"sku":"other_custom","name_es":"Otro trayecto (cotizar en chat)","name_en":"Other route (quote in chat)","price_mxn_cents":3500}]}'::jsonb
  ),
  (
    '15555550206',
    'Transporte / Taxi — Desi Community Rides — Edison, NJ',
    'Ride / Taxi — Desi Community Rides — Edison, NJ',
    'Taxi bilingüe Hindi/English en Edison. Aeropuertos EWR JFK, mandados, temple runs. (demo taxi Middlesex)',
    'Bilingual Hindi/English taxi in Edison. EWR JFK airport runs, errands, temple trips. (demo taxi Middlesex)',
    5800,
    'Edison, NJ',
    '08837',
    40.519,
    -74.412,
    '{"version":1,"currency":"USD","disclaimer_es":"El precio puede variar por tráfico, horario, paradas extra o espera adicional. Se confirma en mensaje antes del viaje.","disclaimer_en":"Price may vary with traffic, time of day, extra stops, or additional wait time. Confirmed by message before the ride.","items":[{"sku":"ewr_airport","name_es":"Aeropuerto Newark (EWR) — desde Edison","name_en":"Newark Liberty (EWR) — from Edison","price_mxn_cents":5800},{"sku":"jfk_airport","name_es":"Aeropuerto JFK — desde Edison","name_en":"JFK Airport — from Edison","price_mxn_cents":12200},{"sku":"edison_local","name_es":"Edison — viaje local (solo ida)","name_en":"Edison local trip (one way)","price_mxn_cents":2800},{"sku":"shopping_errands","name_es":"Compras / mandados (local, solo ida)","name_en":"Shopping / errands (local, one way)","price_mxn_cents":3000},{"sku":"other_custom","name_es":"Otro trayecto (cotizar en chat)","name_en":"Other route (quote in chat)","price_mxn_cents":3500}]}'::jsonb
  ),
  (
    '15555550207',
    'Transporte / Taxi — JFK Express NJ — Edison, NJ',
    'Ride / Taxi — JFK Express NJ — Edison, NJ',
    'Especialista JFK y LGA desde Middlesex. Tarifa fija publicada — no sorpresas. (demo taxi Middlesex)',
    'JFK and LGA specialist from Middlesex. Published flat fares — no surprises. (demo taxi Middlesex)',
    12500,
    'Edison, NJ',
    '08820',
    40.572,
    -74.358,
    '{"version":1,"currency":"USD","disclaimer_es":"El precio puede variar por tráfico, horario, paradas extra o espera adicional. Se confirma en mensaje antes del viaje.","disclaimer_en":"Price may vary with traffic, time of day, extra stops, or additional wait time. Confirmed by message before the ride.","items":[{"sku":"jfk_airport","name_es":"Aeropuerto JFK — desde Middlesex","name_en":"JFK Airport — from Middlesex","price_mxn_cents":11800},{"sku":"lga_airport","name_es":"Aeropuerto LaGuardia (LGA) — desde Middlesex","name_en":"LaGuardia (LGA) — from Middlesex","price_mxn_cents":10800},{"sku":"ewr_airport","name_es":"Aeropuerto Newark (EWR) — desde Middlesex","name_en":"Newark Liberty (EWR) — from Middlesex","price_mxn_cents":5500},{"sku":"wait_time_hour","name_es":"Tiempo de espera (por hora)","name_en":"Wait time (per hour)","price_mxn_cents":4000},{"sku":"round_trip_wait","name_es":"Ida y vuelta + 1 h de espera","name_en":"Round trip + 1 hr wait","price_mxn_cents":9500},{"sku":"other_custom","name_es":"Otro trayecto (cotizar en chat)","name_en":"Other route (quote in chat)","price_mxn_cents":3500}]}'::jsonb
  ),
  (
    '15555550208',
    'Transporte / Taxi — RWJ Hospital Shuttle — New Brunswick, NJ',
    'Ride / Taxi — RWJ Hospital Shuttle — New Brunswick, NJ',
    'Traslados RWJ, Saint Peter''s, y centros de dialisis en Middlesex. (demo taxi Middlesex)',
    'RWJ, Saint Peter''s, and dialysis center runs in Middlesex. (demo taxi Middlesex)',
    3200,
    'New Brunswick, NJ',
    '08901',
    40.495,
    -74.444,
    '{"version":1,"currency":"USD","disclaimer_es":"El precio puede variar por tráfico, horario, paradas extra o espera adicional. Se confirma en mensaje antes del viaje.","disclaimer_en":"Price may vary with traffic, time of day, extra stops, or additional wait time. Confirmed by message before the ride.","items":[{"sku":"hospital_rwj","name_es":"RWJ University Hospital — solo ida","name_en":"RWJ University Hospital — one way","price_mxn_cents":3000},{"sku":"hospital_saint_peters","name_es":"Saint Peter''s University Hospital — solo ida","name_en":"Saint Peter''s University Hospital — one way","price_mxn_cents":3200},{"sku":"wait_time_hour","name_es":"Tiempo de espera (por hora)","name_en":"Wait time (per hour)","price_mxn_cents":3500},{"sku":"round_trip_wait","name_es":"Ida y vuelta + 2 h de espera (dialisis)","name_en":"Round trip + 2 hr wait (dialysis)","price_mxn_cents":9000},{"sku":"other_custom","name_es":"Otro trayecto (cotizar en chat)","name_en":"Other route (quote in chat)","price_mxn_cents":3500}]}'::jsonb
  )
) AS v(phone, title_es, title_en, description_es, description_en, price_mxn, location_city, zip_code, lat, lng, service_menu)
JOIN public.users u ON u.phone = v.phone
WHERE NOT EXISTS (
  SELECT 1 FROM public.listings l WHERE l.title_es = v.title_es
)
RETURNING id, title_es, location_city, is_verified;
