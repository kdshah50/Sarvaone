export type Lang = "en" | "es" | "hi" | "gu";

/** Bilingual UI copy (ported NaranjoGo flows use en/es only). */
export type UiLang = "en" | "es";

/** US-first: English default; ES in UI; HI/GU for listing copy + category labels when provided. */
export const DEFAULT_LANG: Lang = "en";

/** Browser persistence for language preference (profile, bookings, etc.). */
export const LANG_STORAGE_KEY = "aisaravanna_lang";

/** Map full Lang to en/es for ported service-flow UI copy. */
export function langForUiCopy(lang: Lang): UiLang {
  return lang === "es" ? "es" : "en";
}

/** Intl locale for date/number formatting in ported service flows. */
export function intlLocale(lang: Lang): string {
  return langForUiCopy(lang) === "en" ? "en-US" : "es-US";
}

/** @deprecated legacy key — use LANG_STORAGE_KEY */
export const NARANJO_LANG_COOKIE = LANG_STORAGE_KEY;

/** Persist language in localStorage (client-only). */
export function persistAppLangClient(lang: Lang): void {
  writeStoredLang(lang);
}

/** Append or update `?lang=` on a path (preserves hash and other query keys). */
export function withLang(path: string, lang: Lang): string {
  const hashIdx = path.indexOf("#");
  const base = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
  const qIdx = base.indexOf("?");
  const pathname = qIdx >= 0 ? base.slice(0, qIdx) : base;
  const params = qIdx >= 0 ? new URLSearchParams(base.slice(qIdx + 1)) : new URLSearchParams();
  return hrefWithLang(pathname, lang, params) + hash;
}

/** Older keys — checked in order when reading preference */
/** Prior spellings / keys users may still have in localStorage */
const LEGACY_LANG_KEYS = ["aisarvanna_lang", "aisarvana_lang", "naranjo_lang"] as const;

/**
 * Resolve language from `?lang=` query. Unknown or missing → English.
 */
export function langFromParam(raw: string | null | undefined): Lang {
  const v = raw?.trim()?.toLowerCase();
  if (v === "es") return "es";
  if (v === "en") return "en";
  if (v === "hi") return "hi";
  if (v === "gu") return "gu";
  return DEFAULT_LANG;
}

/** Read stored language preference; migrates legacy keys. */
export function readStoredLang(): Lang | null {
  if (typeof window === "undefined") return null;
  try {
    for (const k of [LANG_STORAGE_KEY, ...LEGACY_LANG_KEYS]) {
      const v = localStorage.getItem(k);
      if (v === "en" || v === "es" || v === "hi" || v === "gu") return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

/** Listing detail URL preserving UI language (omit default English). */
export function listingHref(listingId: string, lang: Lang = DEFAULT_LANG): string {
  if (lang === DEFAULT_LANG) return `/listing/${listingId}`;
  return `/listing/${listingId}?lang=${encodeURIComponent(lang)}`;
}

/** Same path + query with `lang` set or removed (English = omit). Preserves other query keys when `preserveSearch` is passed. */
export function hrefWithLang(pathname: string, lang: Lang, preserveSearch?: URLSearchParams): string {
  const p = preserveSearch ? new URLSearchParams(preserveSearch.toString()) : new URLSearchParams();
  if (lang === DEFAULT_LANG) p.delete("lang");
  else p.set("lang", lang);
  const q = p.toString();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return q ? `${path}?${q}` : path;
}

/** @deprecated use readStoredLang() — kept for imports that only need the key name */
export const LEGACY_LANG_STORAGE_KEY_AISARVANA = "aisarvana_lang";

/** @deprecated use readStoredLang() */
export const LEGACY_LANG_STORAGE_KEY = "naranjo_lang";
