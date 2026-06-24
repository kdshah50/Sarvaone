"use client";
import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { COLONIAS, coloniaKeysSorted, detectColoniaInQuery, coloniaLabel } from "@/lib/colonias";
import { detectZipInQuery } from "@/lib/us-zip";
import { langFromParam } from "@/lib/i18n-lang";
import { UsdWhole } from "@/components/UsdAmount";

/** Slider top = “no upper cap” in the URL (pmax omitted). Whole US dollars. */
const PRICE_MAX_UI = 50_000;
const PRICE_SLIDER_STEP = 50;

const HERO_SERVICE_VERTICALS = [
  { href: "/home-cleaning", en: "Home cleaning", es: "Limpieza del hogar" },
  { href: "/pet-care", en: "Pet care", es: "Cuidado de mascotas" },
  { href: "/ride-share", en: "Ride share", es: "Transporte" },
  { href: "/veterinary", en: "Veterinary", es: "Veterinaria" },
] as const;

function heroServiceVerticalsSorted(lang: ReturnType<typeof langFromParam>) {
  const locale = lang === "es" ? "es" : "en";
  return [...HERO_SERVICE_VERTICALS].sort((a, b) => {
    const la = lang === "es" ? a.es : a.en;
    const lb = lang === "es" ? b.es : b.en;
    return la.localeCompare(lb, locale, { sensitivity: "base" });
  });
}

const T = {
  es: {
    badge: "EE. UU. • SERVICIOS",
    line1: "eCommerce",
    line2: "con Confianza",
    sub: "Servicios locales verificados en Estados Unidos.",
    placeholder: "Ej. limpieza sábado menos de USD 120, o plomeros cerca del CP 08854...",
    btn: "Buscar",
    near: "Cerca de mí",
    chipLabel: "Buscar por condado:",
    priceTitle: "Precio (USD)",
    priceMin: "Mín.",
    priceMax: "Máx.",
    noMax: "Sin límite",
  },
  en: {
    badge: "UNITED STATES • SERVICES",
    line1: "eCommerce",
    line2: "with Confidence",
    sub: "Verified local services across the United States.",
    placeholder:
      "E.g. house cleaning Saturday under $120, or plumbers near ZIP 08854...",
    btn: "Search",
    near: "Near me",
    chipLabel: "Search by county:",
    priceTitle: "Price (USD)",
    priceMin: "Min.",
    priceMax: "Max.",
    noMax: "No max",
  },
  hi: {
    badge: "संयुक्त राज्य अमेरिका • सेवाएँ",
    line1: "eCommerce",
    line2: "विश्वास के साथ",
    sub: "संयुक्त राज्य अमेरिका भर में सत्यापित स्थानीय सेवाएँ।",
    placeholder:
      "उदा. शनिवार घर की सफ़ाई $120 से कम, या ZIP 08854 के पास प्लम्बर...",
    btn: "खोजें",
    near: "मेरे पास",
    chipLabel: "काउंटी से खोजें:",
    priceTitle: "मूल्य (USD)",
    priceMin: "न्यून.",
    priceMax: "अधिकतम",
    noMax: "कोई अधिकतम नहीं",
  },
  gu: {
    badge: "યુનાઇટેડ સ્ટેટ્સ • સેવાઓ",
    line1: "eCommerce",
    line2: "વિશ્વાસ સાથે",
    sub: "સંયુક્ત રાજ્ય અમેરિકામાં ચકાસાયેલ સ્થાનિક સેવાઓ.",
    placeholder:
      "દા.ત. શનિવારે ઘર સફાઈ $120 થી ઓછી, અથવા ZIP 08854 નજીક પ્લમ્બર...",
    btn: "શોધો",
    near: "મારી નજીક",
    chipLabel: "કાઉન્ટી પ્રમાણે શોધો:",
    priceTitle: "કિંમત (USD)",
    priceMin: "ન્યૂન.",
    priceMax: "મહત્તમ",
    noMax: "મહત્તમ નહીં",
  },
};

function HeroInner({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(PRICE_MAX_UI);
  const [geoLoading, setGeoLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const lang = langFromParam(params.get("lang"));
  const t = T[lang];
  const activeColonia = params.get("colonia") ?? "";
  const sortedCountyKeys = coloniaKeysSorted(lang);
  const sortedServiceVerticals = heroServiceVerticalsSorted(lang);

  const priceKey = `${params.get("pmin") ?? ""}|${params.get("pmax") ?? ""}`;
  useEffect(() => {
    const pm = parseInt(params.get("pmin") ?? "0", 10);
    const min = Number.isFinite(pm) && pm > 0 ? Math.min(pm, PRICE_MAX_UI) : 0;
    const px = params.get("pmax");
    let max = PRICE_MAX_UI;
    if (px != null && px !== "") {
      const n = parseInt(px, 10);
      if (Number.isFinite(n) && n > 0) max = Math.min(Math.max(n, min), PRICE_MAX_UI);
    }
    setPriceMin(min);
    setPriceMax(max);
  }, [priceKey]);

  const applyPriceToParams = (p: URLSearchParams) => {
    if (priceMin > 0) p.set("pmin", String(priceMin));
    else p.delete("pmin");
    if (priceMax < PRICE_MAX_UI) p.set("pmax", String(priceMax));
    else p.delete("pmax");
  };

  /** Search box + ZIP-in-text: resolves US ZIP → lat/lng (Geo → county chips clear `zip`). */
  async function navigateSearch(qRaw: string, extra: Record<string, string> = {}) {
    const p = new URLSearchParams(params.toString());
    p.set("category", params.get("category") || "services");

    let finalQ = qRaw.trim();

    if (finalQ && !extra.colonia) {
      const detected = detectColoniaInQuery(finalQ);
      if (detected) {
        const c = COLONIAS[detected.coloniaKey];
        p.set("colonia", detected.coloniaKey);
        p.set("lat", String(c.lat));
        p.set("lng", String(c.lng));
        p.delete("zip");
        finalQ = detected.cleanedQuery;
      }
    }

    Object.entries(extra).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));

    const hasCoords = !!(p.get("lat") && p.get("lng"));
    if (!hasCoords && finalQ) {
      const zp = detectZipInQuery(finalQ);
      if (zp?.zip) {
        setGeoLoading(true);
        try {
          const r = await fetch(`/api/geo/zip?zip=${encodeURIComponent(zp.zip)}`);
          if (r.ok) {
            const j = (await r.json()) as { lat: number; lng: number };
            p.set("zip", zp.zip);
            p.set("lat", String(j.lat));
            p.set("lng", String(j.lng));
            finalQ = zp.cleanedQuery;
          }
        } finally {
          setGeoLoading(false);
        }
      }
    }

    if (finalQ) p.set("q", finalQ);
    else p.delete("q");
    applyPriceToParams(p);
    router.push(`/?${p.toString()}`);
  }

  function go(q: string, extra: Record<string, string> = {}) {
    void navigateSearch(q, extra);
  }
  const setMinSlider = (v: number) => {
    const next = Math.max(0, Math.min(v, PRICE_MAX_UI));
    setPriceMin(next);
    if (next > priceMax) setPriceMax(next);
  };

  const setMaxSlider = (v: number) => {
    const next = Math.max(0, Math.min(v, PRICE_MAX_UI));
    setPriceMax(next);
    if (next < priceMin) setPriceMin(next);
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeoLoading(false);
        go(query, {
          lat: coords.latitude.toFixed(6),
          lng: coords.longitude.toFixed(6),
          colonia: "",
          zip: "",
        });
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  };

  const handleColonia = (key: string) => {
    const isActive = activeColonia === key;
    if (isActive) {
      go(query, { colonia: "" });
    } else {
      const c = COLONIAS[key];
      go(query, { colonia: key, lat: String(c.lat), lng: String(c.lng), zip: "" });
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#1B4332] py-16 px-4 overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[#D4A017]/10 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-2xl mx-auto text-center relative z-10">
        <div className="inline-block bg-[#D4A017]/20 rounded-full px-4 py-1.5 mb-4">
          <span className="text-[#F0C040] text-xs font-bold tracking-widest">✦ {t.badge}</span>
        </div>

        <h1 className="font-serif text-4xl md:text-5xl font-bold text-white leading-tight mb-3">
          {t.line1}<br />{t.line2}
        </h1>
        <p className="text-white/70 text-base mb-6">{t.sub}</p>

        {/* Search bar */}
        <div className="bg-white rounded-2xl p-1.5 flex items-center gap-2 shadow-2xl mb-3">
          <span className="text-lg pl-3">🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && go(query)}
            placeholder={t.placeholder}
            className="flex-1 bg-transparent text-[#1C1917] placeholder-[#A8A095] outline-none text-base py-2"
          />
          <button
            onClick={() => go(query)}
            className="bg-[#1B4332] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#2D6A4F] transition-colors whitespace-nowrap"
          >
            {t.btn}
          </button>
        </div>

        {/* Price range — combines with natural-language price phrases in `q` (stricter wins server-side). */}
        <div
          className="rounded-2xl px-4 py-3 mb-3 text-left max-w-xl mx-auto"
          style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)" }}
        >
          <p className="text-[11px] font-bold tracking-wide text-[#F0C040]/90 mb-2">{t.priceTitle}</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[11px] text-white/80 mb-1">
                <span>{t.priceMin}</span>
                <span className="font-semibold text-white">
                  <UsdWhole dollars={priceMin} lang={lang} />
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={PRICE_MAX_UI}
                step={PRICE_SLIDER_STEP}
                value={priceMin}
                onChange={(e) => setMinSlider(Number(e.target.value))}
                className="w-full accent-[#D4A017] h-2"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-white/80 mb-1">
                <span>{t.priceMax}</span>
                <span className="font-semibold text-white">
                  {priceMax >= PRICE_MAX_UI ? t.noMax : <UsdWhole dollars={priceMax} lang={lang} />}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={PRICE_MAX_UI}
                step={PRICE_SLIDER_STEP}
                value={priceMax}
                onChange={(e) => setMaxSlider(Number(e.target.value))}
                className="w-full accent-[#D4A017] h-2"
              />
            </div>
          </div>
        </div>

        {/* Near me */}
        <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
          <button
            onClick={handleNearMe}
            disabled={geoLoading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-60 transition-all"
            style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
          >
            {geoLoading
              ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Localizando...</>
              : <>📍 {t.near}</>
            }
          </button>
        </div>

        {/* Service vertical landings — A→Z; single column on narrow screens so wrap never breaks reading order */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto mb-4">
          {sortedServiceVerticals.map((v) => (
            <Link
              key={v.href}
              href={lang === "en" ? v.href : `${v.href}?lang=${lang}`}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-white/90 hover:bg-white/20 border border-white/20 transition-all"
            >
              {lang === "es" ? v.es : v.en}
            </Link>
          ))}
        </div>

        {/* Colonia chips */}
        <div className="mt-1 mb-2">
          <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase">
            {t.chipLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-w-2xl mx-auto text-left">
          {sortedCountyKeys.map((key) => {
            const c = COLONIAS[key];
            const active = activeColonia === key;
            return (
              <button
                key={key}
                onClick={() => handleColonia(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active
                    ? "bg-[#D4A017] text-[#1B4332] shadow-md scale-105"
                    : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/20"
                }`}
              >
                📍 {coloniaLabel(key, lang)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Hero({ initialQuery = "" }: { initialQuery?: string }) {
  return (
    <Suspense fallback={<div className="bg-[#1B4332] py-16 h-64" />}>
      <HeroInner initialQuery={initialQuery} />
    </Suspense>
  );
}
