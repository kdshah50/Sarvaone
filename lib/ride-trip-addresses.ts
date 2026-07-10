import type { ServiceQuoteMetadata } from "@/lib/service-quote";

export type RideTripAddresses = {
  pickup: string;
  dropoff: string;
};

/** Parse pickup/dropoff from structured metadata or legacy combined serviceAddress. */
export function parseRideTripAddresses(
  meta: ServiceQuoteMetadata | null | undefined,
  serviceAddress?: string | null,
): RideTripAddresses | null {
  const pickup = meta?.pickupAddress?.trim();
  const dropoff = meta?.dropoffAddress?.trim();
  if (pickup && dropoff) {
    return { pickup, dropoff };
  }

  const combined = (meta?.serviceAddress ?? serviceAddress ?? "").trim();
  if (!combined) return null;

  const origen = combined.match(/(?:Origen|From|Pickup):\s*(.+?)(?:\n|$)/i);
  const destino = combined.match(/(?:Destino|To|Drop-?off):\s*(.+?)(?:\n|$)/i);
  if (origen?.[1] && destino?.[1]) {
    return { pickup: origen[1].trim(), dropoff: destino[1].trim() };
  }

  return null;
}

export function isTransportListingTitle(title: string | null | undefined): boolean {
  const t = String(title ?? "").trim();
  return t.startsWith("Transporte / Taxi —") || t.startsWith("Ride / Taxi —");
}
