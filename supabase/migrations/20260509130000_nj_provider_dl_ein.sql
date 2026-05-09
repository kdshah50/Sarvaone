-- NJ/US provider identity: driver's license (individual) and EIN (registered business).
-- Legacy columns (curp, rfc, ine_*) remain for historical rows; app prefers DL/EIN for new data.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS provider_entity_type TEXT
    CHECK (provider_entity_type IS NULL OR provider_entity_type IN ('individual', 'business'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS drivers_license_number TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dl_photo_url TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dl_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ein TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ein_verified BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.provider_entity_type IS 'Service provider: individual vs registered business (NJ-focused flows).';
COMMENT ON COLUMN public.users.drivers_license_number IS 'Optional DL identifier on file (manual review).';
COMMENT ON COLUMN public.users.dl_photo_url IS 'Private storage object key for DL image (same bucket pattern as legacy INE photos).';
COMMENT ON COLUMN public.users.dl_verified IS 'Admin verified DL / individual identity.';
COMMENT ON COLUMN public.users.ein IS 'Employer Identification Number for registered businesses (normalized in app).';
COMMENT ON COLUMN public.users.ein_verified IS 'Admin verified EIN for business providers.';

-- Anon/authenticated may read trust flags for listing embeds (matches ine_verified grant pattern).
GRANT SELECT (dl_verified, ein_verified) ON public.users TO anon, authenticated;
