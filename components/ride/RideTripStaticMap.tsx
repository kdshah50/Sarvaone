"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Lang } from "@/lib/i18n-lang";

type Point = { lat: number; lng: number; label: string };

type Props = {
  pickup: string;
  dropoff: string;
  lang?: Lang;
  className?: string;
};

async function geocodeClient(q: string): Promise<Point | null> {
  const res = await fetch(`/api/geocode/address?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat?: number; lng?: number; label?: string };
  if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
  return { lat: data.lat, lng: data.lng, label: data.label ?? q };
}

export default function RideTripStaticMap({ pickup, dropoff, lang = "en", className = "" }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<{ pickup: Point | null; dropoff: Point | null }>({
    pickup: null,
    dropoff: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [p, d] = await Promise.all([geocodeClient(pickup), geocodeClient(dropoff)]);
      if (cancelled) return;
      if (!p && !d) {
        setError(
          lang === "es"
            ? "No se pudo ubicar las direcciones en el mapa."
            : "Could not place addresses on the map.",
        );
        setLoading(false);
        return;
      }
      setPoints({ pickup: p, dropoff: d });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, lang]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current).setView([40.44, -74.4], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    const g = L.layerGroup().addTo(map);
    mapRef.current = map;
    groupRef.current = g;
    return () => {
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group || loading) return;

    group.clearLayers();
    const pts: L.LatLngExpression[] = [];

    if (points.pickup) {
      const m = L.circleMarker([points.pickup.lat, points.pickup.lng], {
        radius: 10,
        fillColor: "#16A34A",
        color: "#14532D",
        weight: 2,
        fillOpacity: 0.9,
      });
      m.bindTooltip(lang === "es" ? "Recogida" : "Pickup", { permanent: false });
      m.addTo(group);
      pts.push([points.pickup.lat, points.pickup.lng]);
    }

    if (points.dropoff) {
      const m = L.circleMarker([points.dropoff.lat, points.dropoff.lng], {
        radius: 10,
        fillColor: "#DC2626",
        color: "#7F1D1D",
        weight: 2,
        fillOpacity: 0.9,
      });
      m.bindTooltip(lang === "es" ? "Destino" : "Drop-off", { permanent: false });
      m.addTo(group);
      pts.push([points.dropoff.lat, points.dropoff.lng]);
    }

    if (pts.length === 2) {
      L.polyline(pts as [number, number][], {
        color: "#1B4332",
        weight: 3,
        opacity: 0.55,
        dashArray: "8 8",
      }).addTo(group);
    }

    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 });
    }
  }, [points, loading, lang]);

  if (error) {
    return (
      <p className={`text-[11px] text-[#6B7280] italic ${className}`} role="status">
        {error}
      </p>
    );
  }

  return (
    <div className={className}>
      {loading && (
        <p className="text-[11px] text-[#6B7280] mb-2" role="status">
          {lang === "es" ? "Cargando mapa…" : "Loading map…"}
        </p>
      )}
      <div
        ref={mapEl}
        className="w-full h-48 rounded-xl border border-[#E5E0D8] overflow-hidden bg-[#E8E4DC]"
        role="img"
        aria-label={lang === "es" ? "Mapa del trayecto" : "Trip map"}
      />
      <p className="text-[10px] text-[#6B7280] mt-1.5 leading-snug">
        {lang === "es"
          ? "Vista aproximada — sin ruta en tiempo real."
          : "Approximate view — no live routing."}
      </p>
    </div>
  );
}
