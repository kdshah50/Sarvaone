"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppLangSelect from "@/components/AppLangSelect";
import { useCommunityLane } from "@/components/CommunityLaneContext";
import { clampLangForLane } from "@/lib/lang-for-lane";
import { hrefWithLang, langFromParam, listingHref, type Lang } from "@/lib/i18n-lang";
import { canTransitionLifecycle, type BookingLifecycleStatus } from "@/lib/booking-lifecycle";
import { mergeBookingsListWithDetailTruth } from "@/lib/booking-client-detail-truth";
import { isTransportListingTitle } from "@/lib/ride-trip-addresses";
import DriverEnRouteButton from "@/components/ride/DriverEnRouteButton";

type SellerBooking = {
  id: string;
  listing_id: string;
  status: string;
  payment_status: string;
  ticket_code?: string | null;
  listing_title: string;
  buyer_name: string;
  listing_chat_path?: string | null;
  appointment_at?: string | null;
  paid_at?: string | null;
  driver_en_route_at?: string | null;
};

type SellerStats = {
  sellerPaidBookings: number;
  sellerCompletedPaid: number;
  sellerActivePaidBookings: number;
};

function statusLabel(status: string, lang: Lang): string {
  const s = status.toLowerCase();
  if (lang === "es") {
    if (s === "confirmed") return "Confirmada (pagada)";
    if (s === "scheduled") return "Agendada";
    if (s === "in_progress") return "En curso";
    if (s === "completed") return "Completada";
    if (s === "cancelled") return "Cancelada";
    return s;
  }
  if (s === "confirmed") return "Confirmed (paid)";
  if (s === "scheduled") return "Scheduled";
  if (s === "in_progress") return "In progress";
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  return s;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed") return "bg-emerald-100 text-emerald-900";
  if (s === "cancelled") return "bg-red-50 text-red-800";
  if (s === "in_progress") return "bg-blue-100 text-blue-900";
  if (s === "scheduled") return "bg-indigo-100 text-indigo-900";
  return "bg-amber-100 text-amber-900";
}

function nextActions(status: string): BookingLifecycleStatus[] {
  const s = (status ?? "confirmed").toLowerCase();
  const out: BookingLifecycleStatus[] = [];
  for (const target of ["scheduled", "in_progress", "completed"] as const) {
    if (canTransitionLifecycle(s, target)) out.push(target);
  }
  return out;
}

export default function SellerBookingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#FDF8F1] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <SellerBookingsPageInner />
    </Suspense>
  );
}

function SellerBookingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lane } = useCommunityLane();
  const lang = clampLangForLane(langFromParam(searchParams.get("lang")), lane);
  const ticketFilter = searchParams.get("ticket")?.trim() ?? "";

  const [bookings, setBookings] = useState<SellerBooking[]>([]);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [apptLocal, setApptLocal] = useState<Record<string, string>>({});

  const t =
    lang === "es"
      ? {
          back: "← Mi perfil",
          title: "Reservas de clientes",
          subtitle: "Marca agendada, en curso o completada. El cliente recibe aviso en la app y por WhatsApp.",
          empty: "Aún no tienes reservas pagadas.",
          active: "Activas",
          done: "Completadas",
          total: "Total pagadas",
          ticket: "Ticket",
          buyer: "Cliente",
          markScheduled: "Marcar agendada",
          markInProgress: "Marcar en curso",
          markCompleted: "Marcar completada",
          visitWhen: "Fecha y hora de visita (opcional)",
          chat: "Abrir chat",
          listing: "Ver anuncio",
          saved: "✓ Actualizado",
        }
      : {
          back: "← My profile",
          title: "Client bookings",
          subtitle: "Mark scheduled, in progress, or completed. Clients get in-app and WhatsApp alerts.",
          empty: "No paid bookings yet.",
          active: "Active",
          done: "Completed",
          total: "Total paid",
          ticket: "Ticket",
          buyer: "Client",
          markScheduled: "Mark scheduled",
          markInProgress: "Mark in progress",
          markCompleted: "Mark completed",
          visitWhen: "Visit date & time (optional)",
          chat: "Open chat",
          listing: "View listing",
          saved: "✓ Updated",
        };

  const loadData = useCallback(async () => {
    const qs = new URLSearchParams({ seller: "1", status: "paid" });
    if (ticketFilter) qs.set("ticket", ticketFilter);
    const res = await fetch(`/api/bookings?${qs.toString()}`, { credentials: "same-origin" });
    if (res.status === 401) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/seller-bookings")}`);
      return;
    }
    const data = res.ok ? await res.json() : { bookings: [] };
    const list = Array.isArray(data.bookings) ? (data.bookings as SellerBooking[]) : [];
    const merged = await mergeBookingsListWithDetailTruth([], list);
    setBookings(merged);
    if (data.sellerStats) setStats(data.sellerStats as SellerStats);
    setLoading(false);
  }, [router, ticketFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const advance = async (booking: SellerBooking, nextStatus: BookingLifecycleStatus) => {
    setBusyId(booking.id);
    setMsg((prev) => ({ ...prev, [booking.id]: "" }));
    try {
      const body: Record<string, string> = { status: nextStatus };
      if (nextStatus === "scheduled") {
        const local = apptLocal[booking.id]?.trim();
        if (local) body.appointmentAt = new Date(local).toISOString();
      }
      const res = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Error");
      setMsg((prev) => ({ ...prev, [booking.id]: t.saved }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tianguis:booking-lifecycle", { detail: { listingId: booking.listing_id } }),
        );
      }
      await loadData();
    } catch (e: unknown) {
      setMsg((prev) => ({
        ...prev,
        [booking.id]: e instanceof Error ? e.message : "Error",
      }));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FDF8F1] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const active = bookings.filter((b) => !["completed", "cancelled"].includes(String(b.status ?? "").toLowerCase()));

  return (
    <main className="min-h-screen bg-[#FDF8F1] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link href={hrefWithLang("/profile", lang)} className="text-sm text-[#6B7280] hover:text-[#1B4332]">
            {t.back}
          </Link>
          <AppLangSelect labelLang={lang} />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#1C1917] mb-1">{t.title}</h1>
        <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">{t.subtitle}</p>

        {ticketFilter && (
          <p className="mb-4 text-xs font-semibold text-[#1B4332] bg-[#ECFDF5] border border-emerald-200 rounded-xl px-3 py-2">
            {lang === "es" ? "Filtrando ticket:" : "Filtering ticket:"}{" "}
            <span className="font-mono">{ticketFilter}</span>
          </p>
        )}

        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { value: stats.sellerActivePaidBookings, label: t.active },
              { value: stats.sellerCompletedPaid, label: t.done },
              { value: stats.sellerPaidBookings, label: t.total },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-[#E5E0D8] p-3 text-center">
                <div className="text-xl font-bold text-[#1B4332]">{s.value}</div>
                <div className="text-[10px] text-[#6B7280] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E0D8] p-10 text-center">
            <p className="text-sm text-[#6B7280]">{t.empty}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(ticketFilter ? bookings : active.length > 0 ? active : bookings).map((b) => {
              const st = String(b.status ?? "confirmed").toLowerCase();
              const actions = nextActions(st);
              const showApptInput = actions.includes("scheduled");
              const highlighted =
                ticketFilter &&
                b.ticket_code &&
                b.ticket_code.toLowerCase() === ticketFilter.toLowerCase();

              return (
                <div
                  key={b.id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm ${
                    highlighted ? "border-[#1B4332] ring-2 ring-[#1B4332]/20" : "border-[#E5E0D8]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#1C1917] truncate">{b.listing_title}</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {t.buyer}: {b.buyer_name}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusBadgeClass(st)}`}>
                      {statusLabel(st, lang)}
                    </span>
                  </div>

                  {b.ticket_code && (
                    <p className="text-[11px] text-[#374151] mb-2">
                      <span className="font-semibold uppercase tracking-wide text-[#6B7280]">{t.ticket}:</span>{" "}
                      <span className="font-mono font-bold">{b.ticket_code}</span>
                    </p>
                  )}

                  {b.appointment_at && (
                    <p className="text-[11px] text-indigo-900 bg-indigo-50 rounded-lg px-2 py-1.5 mb-2">
                      📅{" "}
                      {new Date(b.appointment_at).toLocaleString(lang === "es" ? "es-MX" : "en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    {b.listing_chat_path && (
                      <Link
                        href={hrefWithLang(b.listing_chat_path, lang)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#F4F0EB] text-[#1B4332] hover:bg-[#EDE8E0]"
                      >
                        {t.chat}
                      </Link>
                    )}
                    <Link
                      href={listingHref(b.listing_id, lang)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E5E0D8] text-[#374151] hover:bg-[#F4F0EB]"
                    >
                      {t.listing}
                    </Link>
                  </div>

                  {isTransportListingTitle(b.listing_title) &&
                    !["completed", "cancelled"].includes(st) && (
                      <div className="mb-3">
                        <DriverEnRouteButton
                          bookingId={b.id}
                          lang={lang}
                          alreadyEnRoute={Boolean(b.driver_en_route_at)}
                        />
                      </div>
                    )}

                  {actions.length > 0 && (
                    <div className="border-t border-[#F4F0EB] pt-3 space-y-2">
                      {showApptInput && (
                        <label className="block">
                          <span className="text-[10px] font-semibold text-[#6B7280]">{t.visitWhen}</span>
                          <input
                            type="datetime-local"
                            value={apptLocal[b.id] ?? ""}
                            onChange={(e) => setApptLocal((prev) => ({ ...prev, [b.id]: e.target.value }))}
                            className="mt-1 w-full border border-[#E5E0D8] rounded-lg px-2 py-1.5 text-xs"
                          />
                        </label>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {actions.includes("scheduled") && (
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => void advance(b, "scheduled")}
                            className="px-3 py-2 rounded-xl bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            {busyId === b.id ? "…" : t.markScheduled}
                          </button>
                        )}
                        {actions.includes("in_progress") && (
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => void advance(b, "in_progress")}
                            className="px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            {busyId === b.id ? "…" : t.markInProgress}
                          </button>
                        )}
                        {actions.includes("completed") && (
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => void advance(b, "completed")}
                            className="px-3 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold disabled:opacity-50"
                          >
                            {busyId === b.id ? "…" : t.markCompleted}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {msg[b.id] && (
                    <p
                      className={`mt-2 text-xs rounded-lg px-2 py-1.5 ${
                        msg[b.id].startsWith("✓") ? "bg-[#ECFDF5] text-[#065F46]" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {msg[b.id]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
