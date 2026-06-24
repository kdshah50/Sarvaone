"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ListingGrid from "@/components/listings/ListingGrid";
import type { ListingCard } from "@/lib/types";

const ListingsMap = dynamic(() => import("@/components/listings/ListingsMap"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-[min(70vh,520px)] rounded-2xl border border-[#E5E0D8] bg-[#E8E4DC] animate-pulse"
      aria-hidden
    />
  ),
});
import { langFromParam, type Lang } from "@/lib/i18n-lang";

type Props = {
  listings: ListingCard[];
  initialLang: Lang;
  /** Same as server `normalizeBrowseCategory(searchParams.category)` for first paint. */
  initialCategory: string;
  mapCenterLat: number;
  mapCenterLng: number;
  isDev?: boolean;
  devPendingServicesEnabled?: boolean;
  /** When set (hero NL search), cards link into quote/chat flow. */
  searchQuery?: string;
};

export default function ListingBrowseSection({
  listings,
  initialLang,
  initialCategory,
  mapCenterLat,
  mapCenterLng,
  isDev,
  devPendingServicesEnabled,
  searchQuery,
}: Props) {
  const params = useSearchParams();
  const [mode, setMode] = useState<"list" | "map">("list");
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    setLang(langFromParam(params.get("lang")));
  }, [params]);

  const withCoords = useMemo(
    () =>
      listings.filter((l) => {
        const la = l.location_lat;
        const ln = l.location_lng;
        return typeof la === "number" && typeof ln === "number" && !Number.isNaN(la) && !Number.isNaN(ln);
      }),
    [listings],
  );

  const labels =
    lang === "en"
      ? { list: "List", map: "Map", mapHint: "No listings have a map location yet." }
      : { list: "Lista", map: "Mapa", mapHint: "Ningún anuncio tiene ubicación en el mapa todavía." };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        <span className="text-xs text-[#6B7280] mr-auto">
          {lang === "en" ? "View:" : "Vista:"}
        </span>
        <button
          type="button"
          onClick={() => setMode("list")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            mode === "list"
              ? "bg-[#1B4332] text-white"
              : "bg-white border border-[#E5E0D8] text-[#374151] hover:bg-[#F4F0EB]"
          }`}
        >
          {labels.list}
        </button>
        <button
          type="button"
          onClick={() => setMode("map")}
          disabled={withCoords.length === 0}
          title={withCoords.length === 0 ? labels.mapHint : undefined}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
            mode === "map"
              ? "bg-[#1B4332] text-white"
              : "bg-white border border-[#E5E0D8] text-[#374151] hover:bg-[#F4F0EB]"
          }`}
        >
          {labels.map}
        </button>
      </div>

      {mode === "list" ? (
        <ListingGrid
          listings={listings}
          initialLang={initialLang}
          initialCategory={initialCategory}
          isDev={isDev}
          devPendingServicesEnabled={devPendingServicesEnabled}
          searchQuery={searchQuery}
        />
      ) : (
        <>
          {withCoords.length === 0 ? (
            <p className="text-center text-[#6B7280] py-12">{labels.mapHint}</p>
          ) : (
            <ListingsMap listings={withCoords} centerLat={mapCenterLat} centerLng={mapCenterLng} />
          )}
        </>
      )}
    </div>
  );
}
