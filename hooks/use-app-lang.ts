"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n-lang";
import { DEFAULT_LANG, LANG_STORAGE_KEY, persistAppLangClient, readStoredLang } from "@/lib/i18n-lang";

/**
 * Resolves UI language: `?lang=` (if present) wins, then localStorage, else English.
 */
export function useAppLang(): Lang {
  const params = useSearchParams();
  const raw = params.get("lang");
  const fromUrl =
    raw === "en" || raw === "es" || raw === "hi" || raw === "gu" ? (raw as Lang) : null;
  const [fromStorage, setFromStorage] = useState<Lang | null>(null);

  useEffect(() => {
    setFromStorage(readStoredLang());
  }, []);

  useEffect(() => {
    if (fromUrl) {
      persistAppLangClient(fromUrl);
    }
  }, [fromUrl]);

  if (fromUrl) return fromUrl;
  if (fromStorage) return fromStorage;
  return DEFAULT_LANG;
}

/** Updates language in the URL (and localStorage via useAppLang). */
export function useAppLangActions() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setLang = (l: Lang) => {
    persistAppLangClient(l);
    const p = new URLSearchParams(params.toString());
    if (l === DEFAULT_LANG) p.delete("lang");
    else p.set("lang", l);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

  return { setLang };
}

export { LANG_STORAGE_KEY as NARANJO_LANG_COOKIE };
