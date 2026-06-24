import Link from "next/link";
import type { ConciergeRequest } from "@/lib/concierge-intent";
import { categoryLabel } from "@/lib/marketplace-categories";
import { formatUsdCents } from "@/lib/money";
import type { Lang } from "@/lib/i18n-lang";

const VERTICAL_BY_HINT: Record<string, string> = {
  "house cleaning": "/home-cleaning",
  home_cleaning: "/home-cleaning",
  "pet care": "/pet-care",
  pet_care: "/pet-care",
  veterinary: "/veterinary",
  veterinaria: "/veterinary",
};

function verticalHref(serviceHint: string | undefined, lang: Lang): string | null {
  if (!serviceHint?.trim()) return null;
  const key = serviceHint.trim().toLowerCase();
  const path = VERTICAL_BY_HINT[key] ?? VERTICAL_BY_HINT[key.replace(/\s+/g, "_")];
  if (!path) return null;
  return lang !== "en" ? `${path}?lang=${lang}` : path;
}

function hasConciergeSignal(c: ConciergeRequest | null | undefined): c is ConciergeRequest {
  if (!c || c.source === "none") return false;
  return !!(
    c.serviceHint?.trim() ||
    c.preferredWindow?.rawPhrase ||
    c.preferredWindow?.weekdayName ||
    c.budgetMaxCents != null ||
    c.budgetMinCents != null
  );
}

function formatWindow(c: ConciergeRequest, lang: Lang): string | null {
  const w = c.preferredWindow;
  if (!w) return null;
  if (w.rawPhrase?.trim()) return w.rawPhrase.trim();
  if (w.weekdayName) {
    const cap = w.weekdayName.charAt(0).toUpperCase() + w.weekdayName.slice(1);
    return lang === "es" ? cap : cap;
  }
  return null;
}

function formatBudget(c: ConciergeRequest, lang: Lang): string | null {
  const min = c.budgetMinCents;
  const max = c.budgetMaxCents;
  if (min != null && max != null && min > 0 && max > 0) {
    return lang === "es"
      ? `${formatUsdCents(min, lang)} – ${formatUsdCents(max, lang)}`
      : `${formatUsdCents(min, lang)} – ${formatUsdCents(max, lang)}`;
  }
  if (max != null && max > 0) {
    return lang === "es"
      ? `Hasta ${formatUsdCents(max, lang)}`
      : `Up to ${formatUsdCents(max, lang)}`;
  }
  if (min != null && min > 0) {
    return lang === "es"
      ? `Desde ${formatUsdCents(min, lang)}`
      : `From ${formatUsdCents(min, lang)}`;
  }
  return null;
}

export function ConciergeSearchHint({
  lang,
  query,
  concierge,
  searchCategoryHint,
}: {
  lang: Lang;
  query: string;
  concierge: ConciergeRequest | null | undefined;
  searchCategoryHint?: string | null;
}) {
  if (!query.trim()) return null;
  if (!hasConciergeSignal(concierge) && !searchCategoryHint?.trim()) return null;

  const service = concierge?.serviceHint?.trim() ?? null;
  const when = concierge ? formatWindow(concierge, lang) : null;
  const budget = concierge ? formatBudget(concierge, lang) : null;
  const verticalLink = verticalHref(service ?? undefined, lang);
  const categoryHint = searchCategoryHint?.trim() || null;
  const categoryLabelText = categoryHint ? categoryLabel(categoryHint, lang) : null;

  const title =
    lang === "es"
      ? "Asistente de servicios del hogar"
      : lang === "hi"
        ? "होम सर्विस सहायक"
        : lang === "gu"
          ? "હોમ સર્વિસ સહાયક"
          : "Home services assistant";

  const intro =
    lang === "es"
      ? "Interpretamos tu búsqueda para conectarte con proveedores verificados — reserva completa próximamente."
      : lang === "hi"
        ? "हम आपकी खोज को सत्यापित प्रदाताओं से जोड़ने के लिए समझते हैं — पूरी बुकिंग जल्द।"
        : lang === "gu"
          ? "અમે તમારી શોધને ચકાસાયેલ પ્રદાતાઓ સાથે જોડવા માટે સમજીએ છીએ — સંપૂર્ણ બુકિંગ ટૂંક સમયમાં."
          : "We interpreted your search to match vetted local providers — full booking flow coming next.";

  const browseCta =
    lang === "es" ? "Ver proveedores abajo" : lang === "hi" ? "नीचे प्रदाता देखें" : lang === "gu" ? "નીચે પ્રદાતાઓ જુઓ" : "Browse providers below";

  const verticalCta =
    lang === "es"
      ? `Guía de ${service ?? "servicio"}`
      : lang === "hi"
        ? `${service ?? "सेवा"} गाइड`
        : lang === "gu"
          ? `${service ?? "સેવા"} માર્ગદર્શિકા`
          : `${service ?? "Service"} guide`;

  return (
    <div
      className="mb-6 rounded-2xl border border-[#2D6A4F]/30 bg-gradient-to-br from-[#1B4332]/5 to-[#D4A017]/10 px-4 py-4 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0" aria-hidden>
          ✦
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-base font-bold text-[#1B4332]">{title}</h3>
          <p className="text-xs text-[#6B7280] mt-0.5 mb-3">{intro}</p>
          <dl className="flex flex-wrap gap-2 text-xs m-0">
            {service && (
              <>
                <dt className="sr-only">
                  {lang === "es" ? "Servicio" : lang === "hi" ? "सेवा" : lang === "gu" ? "સેવા" : "Service"}
                </dt>
                <dd className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-[#E5E0D8] text-[#1C1917] m-0 font-medium">
                  <span className="font-semibold text-[#6B7280]">
                    {lang === "es" ? "Servicio:" : lang === "hi" ? "सेवा:" : lang === "gu" ? "સેવા:" : "Service:"}
                  </span>{" "}
                  {service}
                </dd>
              </>
            )}
            {categoryLabelText && categoryLabelText !== service && (
              <>
                <dt className="sr-only">
                  {lang === "es" ? "Categoría" : lang === "hi" ? "श्रेणी" : lang === "gu" ? "શ્રેણી" : "Category"}
                </dt>
                <dd className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-[#E5E0D8] text-[#1C1917] m-0 font-medium">
                  <span className="font-semibold text-[#6B7280]">
                    {lang === "es" ? "Categoría:" : lang === "hi" ? "श्रेणी:" : lang === "gu" ? "શ્રેણી:" : "Category:"}
                  </span>{" "}
                  {categoryLabelText}
                </dd>
              </>
            )}
            {when && (
              <>
                <dt className="sr-only">
                  {lang === "es" ? "Cuándo" : lang === "hi" ? "कब" : lang === "gu" ? "ક્યારે" : "When"}
                </dt>
                <dd className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-[#E5E0D8] text-[#1C1917] m-0 font-medium">
                  <span className="font-semibold text-[#6B7280]">
                    {lang === "es" ? "Cuándo:" : lang === "hi" ? "कब:" : lang === "gu" ? "ક્યારે:" : "When:"}
                  </span>{" "}
                  {when}
                </dd>
              </>
            )}
            {budget && (
              <>
                <dt className="sr-only">
                  {lang === "es" ? "Presupuesto" : lang === "hi" ? "बजट" : lang === "gu" ? "બજેટ" : "Budget"}
                </dt>
                <dd className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-[#E5E0D8] text-[#1C1917] m-0 font-medium">
                  <span className="font-semibold text-[#6B7280]">
                    {lang === "es" ? "Presupuesto:" : lang === "hi" ? "बजट:" : lang === "gu" ? "બજેટ:" : "Budget:"}
                  </span>{" "}
                  {budget}
                </dd>
              </>
            )}
          </dl>
          <div className="flex flex-wrap gap-2 mt-3">
            {verticalLink && service && (
              <Link
                href={verticalLink}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#2D6A4F] transition-colors"
              >
                {verticalCta} →
              </Link>
            )}
            <a
              href="#listing-results"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/90 text-[#1B4332] border border-[#2D6A4F]/40 hover:bg-white transition-colors"
            >
              {browseCta}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
