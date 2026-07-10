-- Phase 2/3: taxi ride trip map + driver en-route (no live dispatch).

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS driver_en_route_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS driver_location_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS driver_location_maps_url TEXT;

COMMENT ON COLUMN public.service_bookings.driver_en_route_at IS
  'When the driver tapped I am on my way (transport/taxi bookings).';
COMMENT ON COLUMN public.service_bookings.driver_location_maps_url IS
  'Google Maps link shared at en-route time (snapshot; not live tracking).';
