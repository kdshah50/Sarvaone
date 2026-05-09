import type { Lang } from "@/lib/i18n-lang";

type Props = {
  trustBadge: string;
  /** Driver's license / individual ID verified by admin (legacy: INE). */
  dlVerified: boolean;
  /** EIN verified for registered businesses (legacy: RFC). */
  einVerified?: boolean;
  phoneVerified: boolean;
  lang: Lang;
  /** Listing approved in admin (`listings.is_verified`) — show chip if no stronger signal. */
  platformListingVerified?: boolean;
  /** Slightly larger text on listing detail vs grid cards */
  size?: "sm" | "md";
};

function tierLabel(tier: "bronze" | "gold" | "diamond", lang: Lang): string {
  if (lang === "en") {
    return { bronze: "Bronze", gold: "Gold", diamond: "Diamond" }[tier];
  }
  return { bronze: "Bronce", gold: "Oro", diamond: "Diamante" }[tier];
}

function tierClass(tier: "bronze" | "gold" | "diamond"): string {
  switch (tier) {
    case "bronze":
      return "bg-amber-50 text-amber-900 border-amber-200/90";
    case "gold":
      return "bg-yellow-50 text-yellow-800 border-yellow-200/90";
    case "diamond":
      return "bg-blue-50 text-blue-800 border-blue-200/90";
  }
}

/**
 * Seller trust chips: tier, optional DL (individual ID), optional EIN (business), ✓ Teléfono when phone-only ID path.
 */
export function SellerVerificationBadges({
  trustBadge,
  dlVerified,
  einVerified = false,
  phoneVerified,
  lang,
  platformListingVerified = false,
  size = "sm",
}: Props) {
  const textSm = size === "sm" ? "text-[10px]" : "text-xs";
  const padSm = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-0.5";
  const iconSm = size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";

  const b = (trustBadge ?? "none").toLowerCase();
  const tier = b === "bronze" || b === "gold" || b === "diamond" ? b : null;

  const parts: JSX.Element[] = [];

  if (tier) {
    const title =
      lang === "en"
        ? `${tierLabel(tier, lang)} trust level on AISaravanna`
        : `Nivel de confianza: ${tierLabel(tier, lang)}`;
    parts.push(
      <span
        key="tier"
        className={`${textSm} font-bold ${padSm} rounded-md border shrink-0 ${tierClass(tier)}`}
        title={title}
      >
        {tierLabel(tier, lang)}
      </span>
    );
  }

  if (dlVerified) {
    const title =
      lang === "en"
        ? "Verified: driver license or government ID reviewed"
        : "Verificado: licencia de conducir o identificación revisada";
    parts.push(
      <span
        key="dl"
        className={`inline-flex items-center gap-0.5 ${textSm} font-bold ${padSm} rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300/80 shrink-0`}
        title={title}
      >
        <span className="text-emerald-600" aria-hidden>
          ✓
        </span>
        {lang === "en" ? "DL / ID" : "Licencia / ID"}
      </span>
    );
  }

  if (einVerified) {
    const title =
      lang === "en"
        ? "Verified: business EIN (Employer ID) reviewed by AISaravanna"
        : "Verificado: EIN de negocio revisado por AISaravanna";
    parts.push(
      <span
        key="ein"
        className={`inline-flex items-center gap-0.5 ${textSm} font-bold ${padSm} rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200/90 shrink-0`}
        title={title}
      >
        <span className="text-indigo-600" aria-hidden>
          ✓
        </span>
        EIN
      </span>
    );
  }

  if (phoneVerified && !dlVerified) {
    const title =
      lang === "en" ? "Verified: phone number (WhatsApp)" : "Verificado: número (WhatsApp)";
    const label = lang === "en" ? "Telephone" : "Teléfono";
    parts.push(
      <span
        key="phone"
        className={`inline-flex items-center gap-0.5 ${textSm} font-bold ${padSm} rounded-md bg-red-50 text-red-700 border border-red-200/90 shrink-0`}
        title={title}
      >
        <span className="text-red-600" aria-hidden>
          ✓
        </span>
        {label}
        <svg className={`${iconSm} shrink-0 opacity-90`} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
        </svg>
      </span>
    );
  }

  if (parts.length === 0 && platformListingVerified) {
    const title =
      lang === "en"
        ? "Listing reviewed and approved on AISaravanna"
        : "Anuncio revisado y aprobado en AISaravanna";
    const label = lang === "en" ? "Verified" : "Verificado";
    parts.push(
      <span
        key="platform"
        className={`inline-flex items-center gap-0.5 ${textSm} font-bold ${padSm} rounded-md bg-teal-50 text-teal-800 border border-teal-200/90 shrink-0`}
        title={title}
      >
        <span className="text-teal-600" aria-hidden>
          ✓
        </span>
        {label}
      </span>
    );
  }

  if (parts.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">{parts}</span>
  );
}
