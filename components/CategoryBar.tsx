"use client";
import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MARKETPLACE_CATEGORIES, normalizeBrowseCategory, categoryLabel } from "@/lib/marketplace-categories";
import { categoryVisibleForLane } from "@/lib/community-lane";
import { useCommunityLane } from "@/components/CommunityLaneContext";
import { langFromParam, type Lang } from "@/lib/i18n-lang";

function CategoryBarInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { lane } = useCommunityLane();
  const lang = langFromParam(params.get("lang"));
  const activeId = normalizeBrowseCategory(params.get("category"));

  const visibleCategories = useMemo(() => {
    const locale = lang === "es" ? "es" : "en";
    return MARKETPLACE_CATEGORIES.filter((c) => categoryVisibleForLane(lane, c.communityLanes))
      .slice()
      .sort((a, b) =>
        categoryLabel(a.id, lang).localeCompare(categoryLabel(b.id, lang), locale, {
          sensitivity: "base",
        }),
      );
  }, [lane, lang]);

  useEffect(() => {
    const cat = MARKETPLACE_CATEGORIES.find((c) => c.id === activeId);
    if (!cat) return;
    if (!categoryVisibleForLane(lane, cat.communityLanes)) {
      const p = new URLSearchParams(params.toString());
      p.set("category", "services");
      router.replace(`/?${p.toString()}`);
    }
  }, [lane, activeId, params, router]);

  const selectCategory = (id: string) => {
    const cat = MARKETPLACE_CATEGORIES.find((c) => c.id === id);
    if (!cat?.browseEnabled) return;
    const p = new URLSearchParams(params.toString());
    p.set("category", id);
    router.push(`/?${p.toString()}`);
  };

  return (
    <div className="bg-white border-b border-[#E5E0D8] sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 overflow-x-auto">
        <div className="flex gap-1 py-3 min-w-max items-center">
          <span
            className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-[#6B7280] pr-2 mr-1 border-r border-[#E5E0D8] shrink-0 self-center max-w-[5.5rem] leading-tight"
            title={
              lang === "es"
                ? "Navega por categoría"
                : lang === "hi"
                  ? "श्रेणियाँ ब्राउज़ करें"
                  : lang === "gu"
                    ? "શ્રેણીઓ બ્રાઉઝ કરો"
                    : "Browse by marketplace category"
            }
          >
            {lang === "es" ? "Categorías" : lang === "hi" ? "श्रेणियाँ" : lang === "gu" ? "શ્રેણીઓ" : "Categories"}
          </span>
          {visibleCategories.map((cat) => {
            const enabled = cat.browseEnabled;
            const isActive = activeId === cat.id;
            return (
              <div key={cat.id} className="relative group">
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => selectCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    enabled
                      ? isActive
                        ? "bg-[#1B4332] text-white cursor-pointer shadow-sm"
                        : "bg-[#F4F0EB] text-[#374151] hover:bg-[#E8E3DA] cursor-pointer"
                      : "bg-[#F4F0EB] text-[#C5C0B8] cursor-not-allowed opacity-50"
                  }`}
                >
                  <span
                    className={enabled && !isActive ? "grayscale-[0.3]" : ""}
                    style={{ fontSize: 16 }}
                  >
                    {cat.icon}
                  </span>
                  {categoryLabel(cat.id, lang)}
                  {!enabled && (
                    <span className="text-[9px] font-bold ml-1 px-1 py-0.5 rounded bg-[#E5E0D8] text-[#A8A095]">
                      {lang === "es" ? "Próximo" : lang === "hi" ? "जल्द" : lang === "gu" ? "ટૂંકમાં" : "Soon"}
                    </span>
                  )}
                </button>
                {!enabled && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-[#1C1917] text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {lang === "es" ? "Próximamente" : lang === "hi" ? "जल्द ही" : lang === "gu" ? "ટૂંક સમયમાં" : "Coming soon"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CategoryBar() {
  return (
    <Suspense fallback={<div className="bg-white border-b border-[#E5E0D8] h-14" />}>
      <CategoryBarInner />
    </Suspense>
  );
}
