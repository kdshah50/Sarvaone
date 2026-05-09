import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleRestHeaders, getSupabaseUrl } from "@/lib/service-rest";
import { COLONIAS } from "@/lib/colonias";
import {
  normalizeDriversLicenseForStorage,
  normalizeEinForStorage,
} from "@/lib/nj-provider-ids";

const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER ?? "";
const TWILIO_SID     = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_TOKEN   = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_FROM    = process.env.TWILIO_WHATSAPP_FROM ?? "";

async function notifyAdmin(form: any) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !ADMIN_WHATSAPP || !TWILIO_FROM) return;
  try {
    const msg = [
      `🆕 *AISaravanna — New provider*`,
      `👤 ${form.name}`,
      `📱 ${form.whatsapp}`,
      `🔧 ${form.service_label}`,
      `💰 ~$${form.price} USD`,
      `📍 ${form.colonia ? (COLONIAS[form.colonia]?.label_en ?? form.colonia) : form.city}, NJ`,
      ...(form.provider_entity_type === "business" && form.ein_normalized
        ? [`🏢 EIN: ${form.ein_normalized}`]
        : []),
      ...(form.provider_entity_type === "individual" && form.dl_norm
        ? [`🪪 DL (on file): ${form.dl_norm}`]
        : []),
      ``,
      `"${(form.description ?? "").slice(0, 120)}..."`,
      ``,
      `✅ Términos aceptados: ${form.accepted_at}`,
      `💡 Pendiente: definir comisión antes de aprobar`,
      ``,
      `→ Aprueba en Supabase: is_verified = true`,
    ].join("\n");

    const body = new URLSearchParams({
      From: `whatsapp:${TWILIO_FROM}`,
      To:   `whatsapp:${ADMIN_WHATSAPP}`,
      Body: msg,
    });
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );
  } catch (e) {
    console.error("WhatsApp notify failed:", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const SUPA_URL = getSupabaseUrl();
    const h = { ...getServiceRoleRestHeaders(), "Content-Type": "application/json" as const };
    const body = await req.json();
    const {
      name, whatsapp, service, service_label,
      description, price, city, colonia, address, lang,
      accepted_terms, accepted_pricing, accepted_at,
      provider_entity_type, drivers_license_number, ein, payment_methods,
    } = body;

    // Validate required fields
    if (!name || !whatsapp || !service || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!accepted_terms || !accepted_pricing) {
      return NextResponse.json({ error: "Terms not accepted" }, { status: 400 });
    }

    // Parse price
    const price_mxn = Math.round(
      parseFloat((price ?? "0").toString().replace(/[^0-9.]/g, "")) * 100
    );

    const phone = (whatsapp ?? "").replace(/\s/g, "");

    // 1. Find existing user by phone or create new one
    const userRes = await fetch(
      `${SUPA_URL}/rest/v1/users?phone=eq.${encodeURIComponent(phone)}&select=id`,
      { headers: h }
    );
    const existingUsers = userRes.ok ? await userRes.json() : [];
    let sellerId: string;

    const petRaw = String(provider_entity_type ?? "individual").toLowerCase();
    const providerType = petRaw === "business" ? "business" : "individual";
    const cleanDl = normalizeDriversLicenseForStorage(String(drivers_license_number ?? ""));
    const cleanEin = normalizeEinForStorage(String(ein ?? ""));

    if (existingUsers.length > 0) {
      sellerId = existingUsers[0].id;
      const patch: Record<string, unknown> = {
        provider_entity_type: providerType,
      };
      if (providerType === "individual" && cleanDl) patch.drivers_license_number = cleanDl;
      if (providerType === "business" && cleanEin) patch.ein = cleanEin;
      if (Object.keys(patch).length > 0) {
        await fetch(`${SUPA_URL}/rest/v1/users?id=eq.${sellerId}`, {
          method: "PATCH",
          headers: h,
          body: JSON.stringify(patch),
        }).catch(() => {});
      }
    } else {
      const userPayload: Record<string, unknown> = {
        phone,
        display_name: name,
        trust_badge: "none",
        provider_entity_type: providerType,
      };
      if (providerType === "individual" && cleanDl) userPayload.drivers_license_number = cleanDl;
      if (providerType === "business" && cleanEin) userPayload.ein = cleanEin;

      const newUserRes = await fetch(`${SUPA_URL}/rest/v1/users`, {
        method: "POST",
        headers: {
          ...h,
          Prefer: "return=representation",
        },
        body: JSON.stringify(userPayload),
      });
      if (!newUserRes.ok) {
        const err = await newUserRes.json();
        return NextResponse.json({ error: err }, { status: 500 });
      }
      const newUser = await newUserRes.json();
      sellerId = newUser[0]?.id;
      if (!sellerId) return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // 2. Create listing — is_verified=false (pending admin approval)
    // Get precise coordinates from colonia
    const coloniaData = COLONIAS[colonia ?? "otro"] ?? COLONIAS["otro"];
    const coloniaLabelEs = coloniaData.label;
    const coloniaLabelEn = coloniaData.label_en;
    const locationCity = `${coloniaLabelEn}, NJ`;
    const description_es = address
      ? `${description}\n\nCondado: ${coloniaLabelEs}. Ref: ${address}`
      : `${description}\n\nCondado: ${coloniaLabelEs}`;

    const listing = {
      seller_id:          sellerId,
      title_es:           `${service_label} — ${coloniaLabelEs}, NJ`,
      title_en:           `${service_label} — ${coloniaLabelEn}, NJ`,
      description_es:     description_es,
      price_mxn:          price_mxn > 0 ? price_mxn : 15000,
      category_id:        "services",
      condition:          "new",
      status:             "active",
      is_verified:        false,          // hidden until admin approves
      location_city:      locationCity,
      location_state:     "New Jersey",
      zip_code:           "08854",
      location_lat:       coloniaData.lat,
      location_lng:       coloniaData.lng,
      shipping_available: false,
      negotiable:         true,
      photo_urls:         [],
      payment_methods:    Array.isArray(payment_methods) && payment_methods.length > 0
                            ? payment_methods
                            : ["efectivo", "whatsapp"],
      expires_at:         new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const listingRes = await fetch(`${SUPA_URL}/rest/v1/listings`, {
      method: "POST",
      headers: {
        ...h,
        Prefer: "return=representation",
      },
      body: JSON.stringify(listing),
    });

    if (!listingRes.ok) {
      const err = await listingRes.json();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    // 3. Notify admin via WhatsApp (non-blocking)
    notifyAdmin({
      name, whatsapp, service_label,
      price, city, colonia, description,
      accepted_at,
      provider_entity_type: providerType,
      dl_norm: providerType === "individual" ? cleanDl : "",
      ein_normalized: providerType === "business" ? cleanEin : "",
    }).catch(() => {});

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
