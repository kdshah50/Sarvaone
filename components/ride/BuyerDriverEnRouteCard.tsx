"use client";

import type { Lang } from "@/lib/i18n-lang";

type Props = {
  lang: Lang;
  driverEnRouteAt?: string | null;
  mapsUrl?: string | null;
};

export default function BuyerDriverEnRouteCard({ lang, driverEnRouteAt, mapsUrl }: Props) {
  if (!driverEnRouteAt) return null;

  const when = new Date(driverEnRouteAt).toLocaleString(lang === "es" ? "es-MX" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const t =
    lang === "es"
      ? {
          title: "Tu conductor va en camino",
          at: "Marcado a las",
          open: "Ver ubicación en mapa",
          note: "Enlace de ubicación al momento del aviso — no es seguimiento en vivo.",
        }
      : {
          title: "Your driver is on the way",
          at: "Marked at",
          open: "View location on map",
          note: "Location link from when they tapped en route — not live tracking.",
        };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 space-y-2 mb-3">
      <p className="text-sm font-bold text-[#78350F]">🚕 {t.title}</p>
      <p className="text-[11px] text-[#92400E]">
        {t.at}: {when}
      </p>
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs font-semibold text-[#1B4332] underline hover:no-underline"
        >
          {t.open} →
        </a>
      ) : null}
      <p className="text-[10px] text-[#92400E]/90 leading-snug">{t.note}</p>
    </div>
  );
}
