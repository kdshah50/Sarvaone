"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n-lang";

type Props = {
  bookingId: string;
  lang: Lang;
  alreadyEnRoute?: boolean;
  onShared?: () => void;
};

export default function DriverEnRouteButton({ bookingId, lang, alreadyEnRoute = false, onShared }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(alreadyEnRoute);

  const t =
    lang === "es"
      ? {
          btn: "🚕 Voy en camino",
          busy: "Compartiendo ubicación…",
          done: "✓ En camino — el pasajero fue notificado",
          err: "No se pudo compartir. Intenta de nuevo.",
          hint: "Comparte tu ubicación actual (enlace de mapa, no seguimiento en vivo).",
        }
      : {
          btn: "🚕 I'm on my way",
          busy: "Sharing location…",
          done: "✓ En route — rider notified",
          err: "Could not share. Try again.",
          hint: "Shares your current location as a map link (not live tracking).",
        };

  const share = async () => {
    setBusy(true);
    setErr("");
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 12_000,
              maximumAge: 60_000,
            });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          /* proceed without coords — timestamp + notify still work */
        }
      }

      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/driver-en-route`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? t.err);
      setDone(true);
      onShared?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t.err);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        {t.done}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void share()}
        className="w-full sm:w-auto text-xs font-bold px-4 py-2.5 rounded-xl bg-[#1B4332] text-white hover:bg-[#2D6A4F] disabled:opacity-50 transition-colors"
      >
        {busy ? t.busy : t.btn}
      </button>
      <p className="text-[10px] text-[#6B7280] leading-snug">{t.hint}</p>
      {err ? <p className="text-[11px] text-red-600">{err}</p> : null}
    </div>
  );
}
