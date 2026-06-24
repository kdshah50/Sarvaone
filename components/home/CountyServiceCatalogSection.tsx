import Link from "next/link";
import { coloniaLabel } from "@/lib/colonias";
import type { Lang } from "@/lib/i18n-lang";

export type CountyServiceCatalogRow = {
  service_slug: string;
  label_en: string;
  label_es: string;
  blurb_en: string;
  blurb_es: string;
  strategy_tag: string | null;
};

/** Curated county chips that map to dedicated vertical landing pages. */
const VERTICAL_LANDING: Record<string, string> = {
  home_cleaning: "/home-cleaning",
  pet_care: "/pet-care",
};

function chipHref(
  countyKey: string,
  slug: string,
  lang: Lang,
): string {
  const landing = VERTICAL_LANDING[slug];
  if (landing) {
    return lang !== "en" ? `${landing}?lang=${lang}` : landing;
  }
  const q = slug.replace(/_/g, " ");
  const p = new URLSearchParams({
    category: "services",
    colonia: countyKey,
    q,
  });
  if (lang !== "en") p.set("lang", lang);
  return `/?${p.toString()}`;
}

const TAG_HINT: Record<string, Record<Lang, string>> = {
  recurring: {
    en: "Repeat service",
    es: "Servicio recurrente",
    hi: "बार-बार सेवा",
    gu: "પુનરાવર્તિત સેવા",
  },
  high_ticket: {
    en: "High-trust",
    es: "Alto valor",
    hi: "उच्च भरोसा",
    gu: "ઉચ્ચ વિશ્વાસ",
  },
  trust: {
    en: "Verified quality",
    es: "Calidad verificada",
    hi: "सत्यापित गुणवत्ता",
    gu: "ચકાસાયેલ ગુણવત્તા",
  },
  ai_concierge: {
    en: "AI booking fit",
    es: "Ideal para IA / reservas",
    hi: "AI बुकिंग के अनुकूल",
    gu: "AI બુકિંગ અનુકૂળ",
  },
};

function catalogRowLabel(row: CountyServiceCatalogRow, lang: Lang): string {
  return lang === "es" ? row.label_es : row.label_en;
}

function catalogRowsSortedByLabel(
  items: CountyServiceCatalogRow[],
  lang: Lang,
): CountyServiceCatalogRow[] {
  const locale = lang === "es" ? "es" : "en";
  return [...items].sort((a, b) =>
    catalogRowLabel(a, lang).localeCompare(catalogRowLabel(b, lang), locale, {
      sensitivity: "base",
    }),
  );
}

export function CountyServiceCatalogSection({
  lang,
  countyKey,
  items,
}: {
  lang: Lang;
  countyKey: string;
  items: CountyServiceCatalogRow[];
}) {
  const sortedItems = catalogRowsSortedByLabel(items, lang);
  if (sortedItems.length === 0) return null;

  const countyName = coloniaLabel(countyKey, lang);
  const title =
    lang === "en"
      ? `Service focus in ${countyName}`
      : lang === "es"
        ? `Enfoque de servicios en ${countyName}`
        : lang === "hi"
          ? `${countyName} में सेवा फोकस`
          : `${countyName} માં સેવા ધ્યાન`;
  const intro =
    lang === "en"
      ? "Curated categories we’re prioritizing for verified providers and AI-assisted booking — tap to run a search."
      : lang === "es"
        ? "Categorías priorizadas para proveedores verificados y reservas asistidas por IA — toca para buscar."
        : lang === "hi"
          ? "हम सत्यापित प्रदाताओं और AI सहायित बुकिंग के लिए इन श्रेणियों पर जोर दे रहे हैं — खोज चलाने के लिए टैप करें।"
          : "ચકાસાયેલ પ્રદાતાઓ અને AI-સહાયિત બુકિંગ માટે અમે આ શ્રેણીઓને પ્રાથમિકતા આપીએ છીએ — શોધ ચલાવવા ટૅપ કરો.";

  return (
    <div className="mb-8 rounded-2xl border border-[#E5E0D8] bg-white/90 px-4 py-4 shadow-sm">
      <h3 className="font-serif text-lg font-bold text-[#1C1917]">{title}</h3>
      <p className="text-xs text-[#6B7280] mt-1 mb-3 max-w-3xl">{intro}</p>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {sortedItems.map((row) => {
          const label = catalogRowLabel(row, lang);
          const blurb = lang === "es" ? row.blurb_es : row.blurb_en;
          const tag = row.strategy_tag?.trim();
          const rowHint = tag ? TAG_HINT[tag] : null;
          const tagL = rowHint ? rowHint[lang] : null;
          return (
            <li key={row.service_slug}>
              <Link
                href={chipHref(countyKey, row.service_slug, lang)}
                title={blurb || label}
                className="inline-flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border border-[#D4A017]/40 bg-[#FFFBF0] text-left text-sm font-semibold text-[#1B4332] hover:bg-[#FFF5DC] transition-colors max-w-[14rem]"
              >
                <span className="leading-tight">{label}</span>
                {tagL && (
                  <span className="text-[10px] font-medium text-[#78350F]/90">{tagL}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
