"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { COLONIA_KEYS, COLONIAS as COLONIAS_MAP, coloniaLabel } from "@/lib/colonias";
import { useCommunityLane } from "@/components/CommunityLaneContext";
import AppLangSelect from "@/components/AppLangSelect";
import { UsdCents } from "@/components/UsdAmount";
import { clampLangForLane } from "@/lib/lang-for-lane";
import { langFromParam, hrefWithLang, type Lang } from "@/lib/i18n-lang";
import { PROVIDER_SERVICES } from "@/lib/provider-services";

const COLONIAS_LIST = COLONIA_KEYS.map(key => ({
  value: key,
  es: COLONIAS_MAP[key].label,
  en: COLONIAS_MAP[key].label_en,
  lat: COLONIAS_MAP[key].lat,
  lng: COLONIAS_MAP[key].lng,
}));

const SERVICES = PROVIDER_SERVICES;


const T = {
  es: {
    title:        "Ofrece tu servicio en AISaravanna",
    sub:          "Llega a clientes en Estados Unidos. Perfil bilingüe (inglés y español).",
    step1:        "Tu información",
    step2:        "Tu servicio",
    step3:        "Términos y condiciones",
    step4:        "Confirmar",
    name:         "Nombre completo",
    whatsapp:     "WhatsApp (con código de país)",
    whatsappPh:   "+1 732 555 0100",
    providerType: "Ofrezco servicios como",
    individual:   "Persona física (licencia de conducir)",
    business:     "Negocio registrado (EIN)",
    dl:           "Número de licencia de conducir (opcional)",
    dlPh:         "Como aparece en tu licencia de NJ / EE. UU.",
    dlHelp:       "Ayuda a verificar proveedores individuales. También puedes subir una foto de tu licencia desde tu perfil después del registro.",
    einLabel:     "Número EIN del negocio (opcional)",
    einPh:        "9 dígitos, ej. 12-3456789",
    einHelp:      "Para LLC, corporaciones u otras entidades registradas ante el IRS. Revisión manual.",
    service:      "¿Qué servicio ofreces?",
    desc:         "Describe tu servicio",
    descPh:       "Experiencia, zona de cobertura, horarios, especialidades...",
    price:        "Precio aproximado (USD)",
    pricePh:      "Ej. $500 por visita",
    payment:      "¿Cómo aceptas pago?",
    city:         "Ciudad / área",
    colonia:      "Condado (NJ)",
    address:      "Dirección de referencia (opcional)",
    addressPh:    "Ej. Cerca del jardín principal, frente al parque...",
    next:         "Continuar →",
    back:         "← Atrás",
    submit:       "Enviar solicitud",
    submitting:   "Enviando...",
    doneTitle:    "¡Solicitud recibida!",
    doneSub:      "Revisaremos tu perfil en las próximas 24 horas y te contactaremos por WhatsApp para confirmar tu registro.",
    doneNote:     "Una vez aprobado, tu servicio aparecerá automáticamente en las búsquedas de AISaravanna.",
    free:         "Registro gratuito",
    verified:     "Perfil verificado",
    reach:        "Clientes en EE. UU.",
    termsTitle:   "Términos y condiciones para proveedores",
    term1Title:   "Publicación gratuita",
    term1:        "Registrar tu servicio en AISaravanna es completamente gratuito. No cobramos por aparecer en el directorio.",
    term2Title:   "Modelo de negocio",
    term2:        "AISaravanna puede establecer una comisión o cuota de servicio en el futuro. Los términos comerciales específicos se acordarán contigo directamente antes de cualquier cobro.",
    term3Title:   "Calidad y veracidad",
    term3:        "Debes ser el proveedor real del servicio. La información que proporciones debe ser veraz. AISaravanna puede retirar tu perfil si recibe reportes negativos verificados.",
    term4Title:   "Proceso de aprobación",
    term4:        "Todos los proveedores son revisados manualmente por el equipo de AISaravanna antes de aparecer en el directorio. Nos reservamos el derecho de aprobar o rechazar cualquier solicitud.",
    term5Title:   "Privacidad",
    term5:        "Tu número de WhatsApp no se muestra públicamente. Solo los clientes que hagan clic en 'Contactar' pueden iniciar una conversación contigo.",
    acceptAll:    "He leído y acepto los términos y condiciones",
    acceptPricing:"Entiendo que AISaravanna puede establecer términos comerciales en el futuro, los cuales me serán comunicados antes de cualquier cobro.",
    mustAccept:   "Debes aceptar los términos para continuar",
  },
  en: {
    title:        "List your service on AISaravanna",
    sub:          "Reach customers across the United States. Bilingual-friendly listings.",
    step1:        "Your info",
    step2:        "Your service",
    step3:        "Terms & conditions",
    step4:        "Confirm",
    name:         "Full name",
    whatsapp:     "WhatsApp (with country code)",
    whatsappPh:   "+1 732 555 0100",
    providerType: "I provide services as",
    individual:   "An individual (driver's license ID)",
    business:     "A registered business (EIN)",
    dl:           "Driver license number (optional)",
    dlPh:         "As on your NJ or US license",
    dlHelp:       "Helps verify individual providers. You can upload a license photo from your profile after signup.",
    einLabel:     "Employer Identification Number (EIN) (optional)",
    einPh:        "9 digits, e.g. 12-3456789",
    einHelp:      "For US-registered businesses (IRS EIN). Manual review by our team.",
    service:      "What service do you offer?",
    desc:         "Describe your service",
    descPh:       "Experience, coverage area, hours, specialties...",
    price:        "Approximate price (USD)",
    pricePh:      "e.g. $500 per visit",
    payment:      "How do you accept payment?",
    city:         "City / area",
    colonia:      "County (NJ)",
    address:      "Reference address (optional)",
    addressPh:    "e.g. Near the main garden, by the park...",
    next:         "Continue →",
    back:         "← Back",
    submit:       "Submit application",
    submitting:   "Submitting...",
    doneTitle:    "Application received!",
    doneSub:      "We'll review your profile within 24 hours and contact you via WhatsApp to confirm your registration.",
    doneNote:     "Once approved, your service will automatically appear in AISaravanna searches.",
    free:         "Free to register",
    verified:     "Verified profile",
    reach:        "Real clients in the US",
    termsTitle:   "Provider terms & conditions",
    term1Title:   "Free listing",
    term1:        "Registering your service on AISaravanna is completely free. We do not charge for appearing in the directory.",
    term2Title:   "Business model",
    term2:        "AISaravanna may establish a commission or service fee in the future. Specific commercial terms will be agreed with you directly before any charges apply.",
    term3Title:   "Quality & accuracy",
    term3:        "You must be the actual service provider. All information you provide must be accurate. AISaravanna may remove your profile if verified negative reports are received.",
    term4Title:   "Approval process",
    term4:        "All providers are manually reviewed by the AISaravanna team before appearing in the directory. We reserve the right to approve or reject any application.",
    term5Title:   "Privacy",
    term5:        "Your WhatsApp number is not shown publicly. Only clients who click 'Contact' can start a conversation with you.",
    acceptAll:    "I have read and agree to the terms and conditions",
    acceptPricing:"I understand that AISaravanna may establish commercial terms in the future, which will be communicated to me before any charges apply.",
    mustAccept:   "You must accept the terms to continue",
  },
};

function UnetePageInner() {
  const searchParams = useSearchParams();
  const { lane } = useCommunityLane();
  const lang = clampLangForLane(langFromParam(searchParams.get("lang")), lane);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [termsError, setTermsError] = useState(false);

  const [form, setForm] = useState({
    name: "", whatsapp: "", service: "",
    description: "", price: "",
    provider_entity_type: "individual" as "individual" | "business",
    drivers_license_number: "",
    ein: "",
    city: "New Jersey",
    colonia: "",
    address: "",
    payment_methods: ["efectivo", "whatsapp"] as string[],
    acceptTerms: false,
    acceptPricing: false,
  });

  const t = lang === "es" ? T.es : T.en;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.acceptTerms || !form.acceptPricing) {
      setTermsError(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const selectedService = SERVICES.find(s => s.value === form.service);
      const serviceLabel = selectedService ? (lang === "es" ? selectedService.es : selectedService.en) : form.service;
      const res = await fetch("/api/provider-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          service_label: serviceLabel,
          lang,
          accepted_terms: true,
          accepted_pricing: true,
          accepted_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── DONE screen ──────────────────────────────────────────────────────────────
  if (done) return (
    <main className="min-h-screen bg-[#FDF8F1] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl border border-[#E5E0D8] p-10 max-w-md w-full text-center shadow-sm">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="font-serif text-2xl font-bold text-[#1B4332] mb-3">{t.doneTitle}</h1>
        <p className="text-sm text-[#6B7280] leading-relaxed mb-3">{t.doneSub}</p>
        <p className="text-xs text-[#059669] font-medium leading-relaxed">{t.doneNote}</p>
        <div className="mt-6">
          <a href={hrefWithLang("/", lang)} className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#1B4332] text-white hover:bg-[#2D6A4F] transition-colors">
            ← {lang === "es" ? "Volver al inicio" : "Back to home"}
          </a>
        </div>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#FDF8F1] px-4 py-10">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <a href={hrefWithLang("/", lang)} className="text-sm text-[#6B7280] hover:text-[#1B4332] transition-colors">← AISaravanna</a>
          <AppLangSelect labelLang={lang} />
        </div>

        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-[#1B4332] mb-3">{t.title}</h1>
          <p className="text-sm text-[#6B7280] leading-relaxed mb-5">{t.sub}</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {[t.free, t.verified, t.reach].map(label => (
              <span key={label} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                ✓ {label}
              </span>
            ))}
          </div>
        </div>

        {/* Progress — 4 steps */}
        <div className="flex gap-2 mb-8">
          {[1,2,3,4].map(s => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-1.5 rounded-full transition-all duration-300 ${step >= s ? "bg-[#1B4332]" : "bg-[#E5E0D8]"}`} />
              <span className={`text-[10px] font-medium text-center ${step >= s ? "text-[#1B4332]" : "text-[#A8A095]"}`}>
                {s === 1 ? t.step1 : s === 2 ? t.step2 : s === 3 ? t.step3 : t.step4}
              </span>
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-white rounded-3xl border border-[#E5E0D8] p-8 shadow-sm">

          {/* ── STEP 1: Your info ── */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.name}</label>
                <input value={form.name} onChange={e => set("name", e.target.value)}
                  className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1B4332] transition-colors"
                  placeholder="María García" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.whatsapp}</label>
                <input value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)}
                  className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1B4332] transition-colors"
                  placeholder={t.whatsappPh} type="tel" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.colonia}</label>
                <select value={form.colonia} onChange={e => set("colonia", e.target.value)}
                  className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1B4332] transition-colors bg-white">
                  <option value="">— {lang === "es" ? "Selecciona tu condado" : "Select your county"} —</option>
                  {COLONIAS_LIST.map(c => (
                    <option key={c.value} value={c.value}>{coloniaLabel(c.value, lang)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.address}</label>
                <input value={form.address} onChange={e => set("address", e.target.value)}
                  className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1B4332] transition-colors"
                  placeholder={t.addressPh} />
                <p className="text-xs text-[#A8A095] mt-1">
                  {lang === "es" ? "No se mostrará públicamente — solo para coordenadas de búsqueda." : "Not shown publicly — used only for search location."}
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.providerType}</label>
                <div className="flex flex-col gap-2">
                  {(["individual", "business"] as const).map((k) => (
                    <label
                      key={k}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        form.provider_entity_type === k ? "border-[#1B4332] bg-[#ECFDF5]" : "border-[#E5E0D8]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="provider_entity_type"
                        checked={form.provider_entity_type === k}
                        onChange={() => set("provider_entity_type", k)}
                        className="mt-1 accent-[#1B4332]"
                      />
                      <span className="text-sm">{k === "individual" ? t.individual : t.business}</span>
                    </label>
                  ))}
                </div>
              </div>
              {form.provider_entity_type === "individual" ? (
                <div>
                  <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.dl}</label>
                  <input
                    value={form.drivers_license_number}
                    onChange={(e) => set("drivers_license_number", e.target.value.toUpperCase())}
                    className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1B4332] transition-colors font-mono tracking-wide"
                    placeholder={t.dlPh}
                    maxLength={32}
                  />
                  <p className="text-xs text-[#059669] mt-1 flex items-center gap-1">🛡️ {t.dlHelp}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.einLabel}</label>
                  <input
                    value={form.ein}
                    onChange={(e) => set("ein", e.target.value)}
                    className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1B4332] transition-colors font-mono tracking-wide"
                    placeholder={t.einPh}
                    maxLength={16}
                  />
                  <p className="text-xs text-[#6B7280] mt-1 flex items-center gap-1">📋 {t.einHelp}</p>
                </div>
              )}
              <button onClick={() => setStep(2)}
                disabled={!form.name || !form.whatsapp || !form.colonia}
                className="w-full bg-[#1B4332] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40 hover:bg-[#2D6A4F] transition-colors">
                {t.next}
              </button>
            </div>
          )}

          {/* ── STEP 2: Your service ── */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.service}</label>
                <select value={form.service} onChange={e => set("service", e.target.value)}
                  className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1B4332] transition-colors bg-white">
                  <option value="">— {lang === "es" ? "Selecciona" : "Select"} —</option>
                  {SERVICES.map(s => (
                    <option key={s.value} value={s.value}>{lang === "es" ? s.es : s.en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.desc}</label>
                <textarea value={form.description} onChange={e => set("description", e.target.value)}
                  rows={4} placeholder={t.descPh}
                  className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1B4332] transition-colors resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.price}</label>
                <input value={form.price} onChange={e => set("price", e.target.value)}
                  className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1B4332] transition-colors"
                  placeholder={t.pricePh} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2">{t.payment}</label>
                <div className="flex flex-col gap-2">
                  {([
                    ["efectivo", "💵", lang === "es" ? "Efectivo" : "Cash"],
                    ["spei", "🏦", "SPEI"],
                    ["oxxo", "🏪", "OXXO Pay"],
                    ["mercadopago", "💳", "Mercado Pago"],
                    ["whatsapp", "💬", lang === "es" ? "Acordar por WhatsApp" : "Arrange via WhatsApp"],
                  ] as const).map(([val, icon, label]) => {
                    const checked = form.payment_methods.includes(val);
                    return (
                      <label key={val} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? "border-[#1B4332] bg-[#ECFDF5]" : "border-[#E5E0D8] hover:border-[#1B4332]"}`}>
                        <input type="checkbox" checked={checked}
                          onChange={() => {
                            const next = checked
                              ? form.payment_methods.filter(m => m !== val)
                              : [...form.payment_methods, val];
                            set("payment_methods", next);
                          }}
                          className="accent-[#1B4332] w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">{icon} {label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex-none border border-[#E5E0D8] text-[#6B7280] font-medium py-3 px-5 rounded-xl text-sm hover:border-[#1B4332] transition-colors">
                  {t.back}
                </button>
                <button onClick={() => setStep(3)}
                  disabled={!form.service || !form.description || !form.price}
                  className="flex-1 bg-[#1B4332] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40 hover:bg-[#2D6A4F] transition-colors">
                  {t.next}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Terms & conditions ── */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <h2 className="font-serif text-lg font-bold text-[#1B4332]">{t.termsTitle}</h2>

              {/* Terms list */}
              <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-1">
                {[
                  [t.term1Title, t.term1],
                  [t.term2Title, t.term2],
                  [t.term3Title, t.term3],
                  [t.term4Title, t.term4],
                  [t.term5Title, t.term5],
                ].map(([title, body]) => (
                  <div key={title} className="bg-[#F4F0EB] rounded-xl p-4">
                    <p className="text-xs font-bold text-[#1B4332] mb-1">{title}</p>
                    <p className="text-xs text-[#6B7280] leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>

              {/* Checkboxes */}
              <div className="flex flex-col gap-3">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.acceptTerms ? "border-[#1B4332] bg-[#ECFDF5]" : "border-[#E5E0D8]"}`}>
                  <input type="checkbox" checked={form.acceptTerms}
                    onChange={e => { set("acceptTerms", e.target.checked); setTermsError(false); }}
                    className="mt-0.5 accent-[#1B4332] w-4 h-4 flex-shrink-0" />
                  <span className="text-xs text-[#374151] leading-relaxed">{t.acceptAll}</span>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.acceptPricing ? "border-[#D4A017] bg-[#FFFBEB]" : "border-[#E5E0D8]"}`}>
                  <input type="checkbox" checked={form.acceptPricing}
                    onChange={e => { set("acceptPricing", e.target.checked); setTermsError(false); }}
                    className="mt-0.5 accent-[#D4A017] w-4 h-4 flex-shrink-0" />
                  <span className="text-xs text-[#374151] leading-relaxed">{t.acceptPricing}</span>
                </label>
              </div>

              {termsError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2">{t.mustAccept}</p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="flex-none border border-[#E5E0D8] text-[#6B7280] font-medium py-3 px-5 rounded-xl text-sm hover:border-[#1B4332] transition-colors">
                  {t.back}
                </button>
                <button
                  onClick={() => {
                    if (!form.acceptTerms || !form.acceptPricing) { setTermsError(true); return; }
                    setTermsError(false);
                    setStep(4);
                  }}
                  className="flex-1 bg-[#1B4332] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#2D6A4F] transition-colors">
                  {t.next}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Confirm & submit ── */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              {/* Summary */}
              <div className="bg-[#F4F0EB] rounded-2xl p-5 flex flex-col gap-3">
                {[
                  [t.name,     form.name],
                  ["WhatsApp", form.whatsapp],
                  [t.service,  (() => {
                    const s = SERVICES.find(x => x.value === form.service);
                    return s ? (lang === "es" ? s.es : s.en) : form.service;
                  })()],
                  [t.price, (() => {
                    const raw = String(form.price).trim().replace(/,/g, "");
                    const n = parseFloat(raw);
                    const cents = Number.isFinite(n) ? Math.round(n * 100) : null;
                    return cents != null ? (
                      <UsdCents cents={cents} lang={lang} />
                    ) : (
                      <span translate="no" className="notranslate">{form.price || "—"} USD</span>
                    );
                  })()],
                  [t.colonia,  form.colonia ? coloniaLabel(form.colonia, lang) : form.colonia],
                  [t.providerType, form.provider_entity_type === "individual" ? t.individual : t.business],
                  ...(form.provider_entity_type === "individual" && form.drivers_license_number
                    ? [[t.dl.replace(" (optional)", "").replace(" (opcional)", ""), form.drivers_license_number]]
                    : []),
                  ...(form.provider_entity_type === "business" && form.ein
                    ? [[t.einLabel.replace(" (optional)", "").replace(" (opcional)", ""), form.ein]]
                    : []),
                  [t.payment, form.payment_methods.map(m => {
                    const labels: Record<string, string> = { efectivo: "💵 Efectivo", spei: "🏦 SPEI", oxxo: "🏪 OXXO", mercadopago: "💳 M.Pago", whatsapp: "💬 WhatsApp" };
                    return labels[m] ?? m;
                  }).join(", ")],
                ].map(([label, value], rowIdx) => (
                  <div key={typeof label === "string" ? `${rowIdx}-${label}` : rowIdx} className="flex justify-between text-sm">
                    <span className="text-[#6B7280] font-medium">{label}</span>
                    <span className="text-[#1C1917] font-semibold text-right max-w-[60%]">{value}</span>
                  </div>
                ))}
              </div>

              {/* Terms accepted badges */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-[#065F46] bg-[#ECFDF5] rounded-lg px-3 py-2">
                  <span>✓</span>
                  <span>{lang === "es" ? "Términos y condiciones aceptados" : "Terms and conditions accepted"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#92400E] bg-[#FFFBEB] rounded-lg px-3 py-2">
                  <span>✓</span>
                  <span>{lang === "es" ? "Términos comerciales futuros reconocidos" : "Future commercial terms acknowledged"}</span>
                </div>
              </div>

              <div className="bg-[#F4F0EB] rounded-xl p-4 text-xs text-[#6B7280] leading-relaxed">
                🛡️ {lang === "es"
                  ? "Tu número de WhatsApp nunca se muestra públicamente. Solo clientes verificados pueden contactarte."
                  : "Your WhatsApp number is never shown publicly. Only verified clients can contact you."}
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep(3)}
                  className="flex-none border border-[#E5E0D8] text-[#6B7280] font-medium py-3 px-5 rounded-xl text-sm hover:border-[#1B4332] transition-colors">
                  {t.back}
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex-1 bg-[#D4A017] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40 hover:bg-[#C4900D] transition-colors">
                  {loading ? t.submitting : `✓ ${t.submit}`}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-[#A8A095] mt-6">
          {lang === "es"
            ? "¿Preguntas? Escríbenos a soporte@aisaravanna.com"
            : "Questions? Contact us at support@aisaravanna.com"}
        </p>
      </div>
    </main>
  );
}

export default function UnetePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#FDF8F1]" aria-busy="true" />}>
      <UnetePageInner />
    </Suspense>
  );
}
