import type { Lang } from "@/lib/i18n-lang";
import { formatUsdCents } from "@/lib/money";

/** BCP 47 locale for Intl date/time formatters */
export function intlLocaleForLang(lang: Lang): string {
  return lang === "en" ? "en-US" : "es-US";
}

export function formatDateTimeShort(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(intlLocaleForLang(lang), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Calendar date only (no time). */
export function formatDateMedium(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(intlLocaleForLang(lang), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Day bucket key for grouping chat messages (local calendar day). */
export function conversationDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Section label above messages grouped by day (Hoy / Ayer / date). */
export function formatConversationDayLabel(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfMsg.getTime()) / 86_400_000);
  if (diffDays === 0) return lang === "en" ? "Today" : "Hoy";
  if (diffDays === 1) return lang === "en" ? "Yesterday" : "Ayer";
  return formatDateMedium(iso, lang);
}

/** Format stored USD cents for display (legacy DB fields may say `*_mxn_*`). */
export function formatCurrencyUSD(cents: number, lang: Lang): string {
  return formatUsdCents(cents, lang);
}

/** @deprecated Use formatCurrencyUSD — amounts are USD cents, not MXN. */
export function formatCurrencyMXN(cents: number, lang: Lang): string {
  return formatCurrencyUSD(cents, lang);
}
