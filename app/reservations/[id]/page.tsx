'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, Clock3, Loader2, ShieldCheck, X } from "lucide-react";

import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/shared/badge";
import { LiveDot, Panel, ProgressRail, SectionTitle } from "@/components/platform-ui";
import { confirmReservation, getReservations, releaseReservation, ReservationData } from "@/lib/api";

function useCountdown(expiresAt: string | null) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setSeconds(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return seconds;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function ReservationCheckoutPage() {
  const params = useParams<{ id: string }>();
  const reservationId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!reservationId) return;
    const nextReservations = await getReservations();
    setReservation(nextReservations.find((item) => item.id === reservationId) ?? null);
    setLoading(false);
  }, [reservationId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!reservationId) return;
        const nextReservations = await getReservations();
        if (!active) return;
        setReservation(nextReservations.find((item) => item.id === reservationId) ?? null);
      } catch {
        if (active) setError("Failed to load reservation");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => refresh().catch(() => undefined), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh, reservationId]);

  const seconds = useCountdown(reservation?.status === "PENDING" ? reservation.expiresAt : null);
  const expired = reservation?.status === "PENDING" && seconds === 0;

  const lifecycle = useMemo(() => {
    if (!reservation) return [];
    return [
      { label: "Created hold", at: reservation.createdAt, accent: "slate" },
      ...(reservation.status === "PENDING" ? [{ label: "Awaiting payment", at: reservation.updatedAt, accent: "amber" }] : []),
      ...(reservation.status === "CONFIRMED" ? [{ label: "Payment confirmed", at: reservation.updatedAt, accent: "emerald" }] : []),
      ...(reservation.status === "RELEASED" ? [{ label: expired ? "Expired" : "Released", at: reservation.updatedAt, accent: expired ? "rose" : "slate" }] : []),
    ];
  }, [expired, reservation]);

  async function handleConfirm() {
    if (!reservation) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await confirmReservation(reservation.id);
      setMessage("Payment confirmed. Stock has been permanently decremented.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error && err.message === "RESERVATION_EXPIRED" ? "Reservation expired before payment completed." : err instanceof Error ? err.message : "Failed to confirm reservation");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease() {
    if (!reservation) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await releaseReservation(reservation.id);
      setMessage("Reservation released. Stock is available again.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release reservation");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-6 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-center rounded-[28px] border border-slate-200/80 bg-white/90 p-12 text-sm text-slate-500 shadow-sm">Loading reservation...</div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <PlatformShell
        eyebrow="Reservations"
        title="Reservation not found"
        description="The record may have already been confirmed, released, or expired."
        actions={<Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>}
      >
        <Panel>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></div>
              <div>
                <div className="text-base font-semibold text-slate-950">No active reservation</div>
                <div className="text-sm text-slate-500">Use the dashboard or reservation list to open a live checkout.</div>
              </div>
            </div>
          </div>
        </Panel>
      </PlatformShell>
    );
  }

  const productName = reservation.inventory?.product.name ?? "Unknown product";
  const warehouseName = reservation.inventory?.warehouse.name ?? "Unknown warehouse";

  return (
    <PlatformShell
      eyebrow="Reservation checkout"
      title={productName}
      description={`Held in ${warehouseName} · ${reservation.quantity} unit${reservation.quantity !== 1 ? "s" : ""}`}
      actions={
        <>
          <LiveDot label={reservation.status === "PENDING" ? "payment hold" : reservation.status.toLowerCase()} />
          <Badge variant={expired ? "danger" : reservation.status === "CONFIRMED" ? "success" : reservation.status === "PENDING" ? "warning" : "muted"}>{expired ? "expired" : reservation.status.toLowerCase()}</Badge>
        </>
      }
    >
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel>
          <div className="border-b border-slate-200/80 p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">Transaction window</div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Complete payment before the hold expires</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">This checkout intentionally feels like an operations workflow rather than a consumer cart. The reservation is your concurrency boundary.</p>
              </div>
              <div className={`rounded-[24px] border px-4 py-3 text-right ${expired ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500"><Clock3 className="h-3.5 w-3.5" /> Time left</div>
                <div className={`mt-1 font-mono text-4xl font-semibold ${expired ? "text-rose-700" : "text-amber-700"}`}>{expired ? "0:00" : formatTime(seconds)}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">Reservation summary</div>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between"><span>Reservation ID</span><span className="font-mono text-slate-950">{reservation.id.slice(0, 12)}...</span></div>
                <div className="flex items-center justify-between"><span>Created</span><span>{new Date(reservation.createdAt).toLocaleString()}</span></div>
                <div className="flex items-center justify-between"><span>Expires</span><span>{new Date(reservation.expiresAt).toLocaleString()}</span></div>
                <div className="flex items-center justify-between"><span>Units held</span><span>{reservation.quantity}</span></div>
              </div>
              <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400"><span>Hold progress</span><span>{Math.max(0, Math.floor((seconds / 600) * 100))}%</span></div>
                <ProgressRail value={seconds} max={600} tone={expired ? "rose" : "amber"} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">Warehouse context</div>
                <div className="mt-3 text-lg font-semibold text-slate-950">{warehouseName}</div>
                <div className="mt-1 text-sm text-slate-500">{productName} is currently reserved in this lane.</div>
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-slate-950 p-5 text-white shadow-[0_24px_48px_rgba(15,23,42,0.22)]">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">Payment state</div>
                <div className="mt-2 text-lg font-semibold">{reservation.status === "PENDING" ? "Awaiting confirmation" : reservation.status === "CONFIRMED" ? "Confirmed" : "Released"}</div>
                <div className="mt-2 text-sm text-slate-300">The hold window is the transactional guardrail that prevents overselling while payment finishes.</div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/80 p-5">
            <div className="flex flex-wrap items-center gap-3">
              {reservation.status === "PENDING" && !expired ? (
                <>
                  <button onClick={handleConfirm} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm purchase</button>
                  <button onClick={handleRelease} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:text-rose-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Cancel reservation</button>
                </>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">This reservation is no longer actionable.</div>
              )}
              <Link href="/dashboard" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700">
                Back to dashboard <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <SectionTitle eyebrow="Lifecycle" title="Reservation timeline" description="A concise audit trail of the hold, payment, and release states." />
            <div className="space-y-3 p-5">
              {lifecycle.map((item) => (
                <div key={`${item.label}-${item.at}`} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${item.accent === "emerald" ? "bg-emerald-500" : item.accent === "amber" ? "bg-amber-500" : item.accent === "rose" ? "bg-rose-500" : "bg-slate-400"}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-950">{item.label}</div>
                      <div className="font-mono text-xs text-slate-400">{new Date(item.at).toLocaleTimeString()}</div>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{item.label === "Created hold" ? "Reservation row inserted and inventory reserved." : item.label === "Awaiting payment" ? "The payment window is open and guarded by the transaction." : item.label === "Payment confirmed" ? "Inventory decremented permanently after payment." : "Reserved stock returned to the available pool."}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle eyebrow="Operational note" title="Why this hold feels trustworthy" />
            <div className="space-y-3 p-5 text-sm text-slate-600">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal-700" /> PostgreSQL transactions and idempotency keep retries safe.</div>
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Expired holds are released automatically by cron.</div>
              <div className="flex items-center gap-2"><LiveDot label="polling sync" /> The rest of the app reflects the state without manual refresh.</div>
            </div>
          </Panel>
        </div>
      </div>
    </PlatformShell>
  );
}
