import type { CommunityLane } from "@/lib/community-lane";
import type { Lang } from "@/lib/i18n-lang";

/**
 * Categories shown in the top bar. Only `browseEnabled: true` are clickable.
 *
 * `serviceVertical: true` — same booking/contact semantics as core “services” where relevant, and in **development**
 * with `SHOW_PENDING_SERVICES=true`, unverified rows surface for hybrid-search testing (see `browse-listings-filters`).
 * Keep `PRICE_FLOORS` in `app/api/listings/route.ts` in sync with every enabled `id`.
 *
 * `communityLanes` — when set, the chip is shown mainly for that lane (unset = all lanes).
 *
 * `label.hi` / `label.gu` — used when `?lang=hi` or `?lang=gu` (fallback to English).
 */
export type MarketplaceCategory = {
  id: string;
  icon: string;
  label: { es: string; en: string; hi: string; gu: string };
  browseEnabled: boolean;
  /** Service-like browse vertical (dev pending listings + future booking flows). */
  serviceVertical?: boolean;
  /** If set, surfaced in the category bar when the user’s `community_lane` matches. */
  communityLanes?: CommunityLane[];
};

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  {
    id: "services",
    icon: "🔧",
    label: { es: "Servicios", en: "Services", hi: "सेवाएँ", gu: "સેવાઓ" },
    browseEnabled: true,
    serviceVertical: true,
  },

  {
    id: "beauty",
    icon: "💇",
    label: { es: "Belleza", en: "Beauty", hi: "ब्यूटी", gu: "સૌંદર્ય" },
    browseEnabled: true,
    serviceVertical: true,
  },
  {
    id: "childcare",
    icon: "👶",
    label: { es: "Cuidado infantil", en: "Childcare", hi: "बच्चों की देखभाल", gu: "બાળ સંભાળ" },
    browseEnabled: true,
    serviceVertical: true,
  },
  {
    id: "tutoring",
    icon: "📚",
    label: { es: "Clases / tutorías", en: "Tutoring", hi: "ट्यूशन", gu: "ટ્યુશન" },
    browseEnabled: true,
    serviceVertical: true,
  },
  {
    id: "pet_care",
    icon: "🐕",
    label: { es: "Mascotas", en: "Pet care", hi: "पालतू देखभाल", gu: "પાલતું પ્રાણી સંભાળ" },
    browseEnabled: true,
    serviceVertical: true,
  },
  {
    id: "fitness",
    icon: "🏋️",
    label: { es: "Fitness", en: "Fitness", hi: "फिटनेस", gu: "ફિટનેસ" },
    browseEnabled: true,
    serviceVertical: true,
  },
  {
    id: "handyman",
    icon: "🛠️",
    label: { es: "Reparaciones", en: "Handyman", hi: "मरम्मत", gu: "રિપેર" },
    browseEnabled: true,
    serviceVertical: true,
  },
  {
    id: "landscaping",
    icon: "🌿",
    label: { es: "Jardinería", en: "Landscaping", hi: "लैंडस्केपिंग", gu: "લેન્ડસ્કેપિંગ" },
    browseEnabled: true,
    serviceVertical: true,
  },

  {
    id: "mehndi",
    icon: "💅",
    label: { es: "Mehndi / henna", en: "Mehndi / henna", hi: "मेहंदी", gu: "મેંદી" },
    browseEnabled: true,
    serviceVertical: true,
    communityLanes: ["south_asian"],
  },
  {
    id: "tiffin",
    icon: "🍱",
    label: { es: "Tiffins / comida casera", en: "Tiffin / home meals", hi: "टिफिन", gu: "ટિફિન" },
    browseEnabled: true,
    serviceVertical: true,
    communityLanes: ["south_asian"],
  },
  {
    id: "wedding_photo",
    icon: "📸",
    label: {
      es: "Fotografía / video de bodas",
      en: "Wedding photo & video",
      hi: "शादी फोटो / वीडियो",
      gu: "લગ્ન ફોટો / વીડિયો",
    },
    browseEnabled: true,
    serviceVertical: true,
    communityLanes: ["south_asian"],
  },
  {
    id: "dj_music",
    icon: "🎧",
    label: {
      es: "DJ y música para fiestas",
      en: "DJ & event music",
      hi: "DJ और इवेंट संगीत",
      gu: "DJ અને ઇવેન્ટ સંગીત",
    },
    browseEnabled: true,
    serviceVertical: true,
    communityLanes: ["south_asian"],
  },
  {
    id: "saree_lehenga",
    icon: "👘",
    label: { es: "Saree y lehenga", en: "Saree & lehenga", hi: "साड़ी और लहंगा", gu: "સાડી અને લહેંગા" },
    browseEnabled: true,
    communityLanes: ["south_asian"],
  },
  {
    id: "puja_items",
    icon: "🪔",
    label: {
      es: "Artículos de puja",
      en: "Puja & prayer items",
      hi: "पूजा सामग्री",
      gu: "પૂજા સામગ્રી",
    },
    browseEnabled: true,
    communityLanes: ["south_asian"],
  },
  {
    id: "catering",
    icon: "🍽️",
    label: { es: "Catering", en: "Catering", hi: "केटरिंग", gu: "કેટરિંગ" },
    browseEnabled: true,
    serviceVertical: true,
    communityLanes: ["south_asian"],
  },
  {
    id: "home_improvement",
    icon: "🏗️",
    label: {
      es: "Mejoras del hogar",
      en: "Home improvement",
      hi: "घर की मरम्मत",
      gu: "ઘર સુધારા",
    },
    browseEnabled: true,
    serviceVertical: true,
    communityLanes: ["south_asian"],
  },

  {
    id: "electronics",
    icon: "📱",
    label: { es: "Electrónica", en: "Electronics", hi: "इलेक्ट्रॉनिक्स", gu: "ઇલેક્ટ્રોનિક્સ" },
    browseEnabled: true,
  },
  {
    id: "vehicles",
    icon: "🚗",
    label: { es: "Vehículos", en: "Vehicles", hi: "वाहन", gu: "વાહનો" },
    browseEnabled: true,
  },
  {
    id: "fashion",
    icon: "👗",
    label: { es: "Moda", en: "Fashion", hi: "फैशन", gu: "ફેશન" },
    browseEnabled: true,
  },
  {
    id: "home",
    icon: "🏠",
    label: { es: "Hogar", en: "Home", hi: "घर", gu: "ઘર" },
    browseEnabled: true,
  },
  {
    id: "realestate",
    icon: "🏡",
    label: {
      es: "Bienes Raíces",
      en: "Real Estate",
      hi: "रियल एस्टेट",
      gu: "રિયલ એસ્ટેટ",
    },
    browseEnabled: true,
  },
  {
    id: "sports",
    icon: "⚽",
    label: { es: "Deportes", en: "Sports", hi: "खेल", gu: "રમતગમત" },
    browseEnabled: true,
  },
];

const ENABLED_IDS = new Set(
  MARKETPLACE_CATEGORIES.filter((c) => c.browseEnabled).map((c) => c.id)
);

/** True when `id` is a valid top-level browse slug (lowercase `category_id`). */
export function isBrowseEnabledCategoryId(id: string): boolean {
  return ENABLED_IDS.has(id.trim().toLowerCase());
}

/** Safe slug for PostgREST `category_id=eq.<slug>`. */
export function normalizeBrowseCategory(raw: string | undefined | null): string {
  const s = (raw ?? "services").trim().toLowerCase();
  if (ENABLED_IDS.has(s)) return s;
  return "services";
}

export function categoryLabel(categoryId: string, lang: Lang): string {
  const c = MARKETPLACE_CATEGORIES.find((x) => x.id === categoryId);
  if (!c) {
    if (lang === "es") return "Anuncios";
    if (lang === "hi") return "लिस्टिंग";
    if (lang === "gu") return "લિસ્ટિંગ";
    return "Listings";
  }
  if (lang === "hi") return c.label.hi;
  if (lang === "gu") return c.label.gu;
  return c.label[lang];
}

/** Whether `SHOW_PENDING_SERVICES` in dev applies to this `category_id`. */
export function categoryAllowsDevPendingListings(categoryId: string): boolean {
  const c = MARKETPLACE_CATEGORIES.find((x) => x.id === categoryId);
  return Boolean(c?.browseEnabled && c?.serviceVertical);
}

export function isServiceVerticalCategory(categoryId: string): boolean {
  const c = MARKETPLACE_CATEGORIES.find((x) => x.id === categoryId);
  return Boolean(c?.serviceVertical);
}

/** Browse slugs tagged `serviceVertical` (used when search must span all local-service verticals from the generic Services tab). */
export function browseEnabledServiceVerticalIds(): readonly string[] {
  return MARKETPLACE_CATEGORIES.filter((c) => c.browseEnabled && c.serviceVertical).map((c) => c.id);
}
