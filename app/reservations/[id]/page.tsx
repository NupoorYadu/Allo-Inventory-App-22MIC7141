'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { differenceInSeconds, format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Clock, Loader2, Package, X } from "lucide-react";

import {
  confirmReservation,
  getReservations,
  releaseReservation,
  ReservationData,
} from "@/lib/api";

function useCountdown(expiresAt: string | null) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const tick = () => {
      setSeconds(Math.max(0, differenceInSeconds(new Date(expiresAt), new Date())));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return seconds;
}

function StatusBadge({ status, expired }: { status: ReservationData["status"] | "EXPIRED"; expired?: boolean }) {
  const cls =
    expired || status === "EXPIRED"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "CONFIRMED"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : status === "PENDING"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-500";

  return <span className={`inline-flex rounded-sm border px-2 py-1 text-[11px] font-semibold tracking-wide ${cls}`}>{expired ? "EXPIRED" : status}</span>;
}

export default function ReservationCheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const reservationId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!reservationId) return;

    const reservations = await getReservations();
    const nextReservation = reservations.find((item) => item.id === reservationId) ?? null;
    setReservation(nextReservation);
    setLoading(false);
  }, [reservationId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void refresh().catch(() => {
        setError("Failed to load reservation");
        setLoading(false);
      });
    }, 0);

    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 5000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const seconds = useCountdown(reservation?.status === "PENDING" ? reservation.expiresAt : null);
  const expired = reservation?.status === "PENDING" && seconds === 0;

  const timeline = useMemo(() => {
    if (!reservation) return [];

    return [
      { label: "Created", at: reservation.createdAt },
      ...(reservation.status === "CONFIRMED" ? [{ label: "Confirmed", at: reservation.updatedAt }] : []),
      ...(reservation.status === "RELEASED"
        ? [{ label: expired ? "Expired" : "Released", at: reservation.updatedAt }]
        : []),
    ];
  }, [expired, reservation]);

  async function handleConfirm() {
    if (!reservation) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await confirmReservation(reservation.id);
      setMessage("Payment confirmed. Stock was permanently decremented.");
      await refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to confirm reservation";
      setError(text === "RESERVATION_EXPIRED" ? "Reservation expired before payment completed." : text);
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
      <div className="min-h-screen bg-[#f8fafc] px-6 py-10 text-slate-900">
        <div className="mx-auto flex max-w-3xl items-center justify-center rounded-xl border border-border bg-white p-10 text-sm text-slate-500 shadow-sm">
          Loading reservation...
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-[#f8fafc] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-white p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-900 text-white">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Reservation not found</div>
              <div className="text-xs text-slate-500">The reservation may have been released, confirmed, or expired.</div>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3 text-sm font-medium hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const productName = reservation.inventory?.product.name ?? "Unknown product";
  const warehouseName = reservation.inventory?.warehouse.name ?? "Unknown warehouse";

  return (
    <div className="min-h-screen bg-[#f8fafc] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-white px-3 text-sm font-medium hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <StatusBadge status={reservation.status} expired={expired} />
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Reservation checkout</div>
                <h1 className="mt-2 text-2xl font-semibold">{productName}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {warehouseName} · {reservation.quantity} unit{reservation.quantity !== 1 ? "s" : ""}
                </p>
              </div>
              {reservation.status === "PENDING" && (
                <div className={`rounded-lg border px-4 py-3 text-right ${expired ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {expired ? "Expired" : "Time left"}
                  </div>
                  <div className={`mt-1 font-mono text-2xl font-semibold ${expired ? "text-red-700" : "text-amber-700"}`}>
                    {expired ? "0:00" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Reservation ID</div>
                <div className="mt-1 break-all font-mono text-sm text-slate-700">{reservation.id}</div>
              </div>
              <div className="rounded-lg border border-border bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Created</div>
                <div className="mt-1 text-sm text-slate-700">{format(new Date(reservation.createdAt), "PPpp")}</div>
              </div>
              <div className="rounded-lg border border-border bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Expires</div>
                <div className="mt-1 text-sm text-slate-700">{format(new Date(reservation.expiresAt), "PPpp")}</div>
              </div>
            </div>

            {reservation.status === "PENDING" && (
              <div className={`mt-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${expired ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {expired ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                {expired ? "Payment window ended. Cron cleanup should release this shortly." : "This stock is held while payment completes."}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <div className="mb-4 text-sm font-semibold">Actions</div>
              <div className="space-y-3">
                {reservation.status === "PENDING" && !expired ? (
                  <>
                    <button
                      onClick={handleConfirm}
                      disabled={busy}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Confirm payment
                    </button>
                    <button
                      onClick={handleRelease}
                      disabled={busy}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-border bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Cancel reservation
                    </button>
                  </>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    {reservation.status === "CONFIRMED"
                      ? "This reservation is already confirmed."
                      : reservation.status === "RELEASED"
                        ? "This reservation has been released."
                        : "This reservation has expired."}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <div className="mb-4 text-sm font-semibold">Timeline</div>
              <div className="space-y-3">
                {timeline.map((item) => (
                  <div key={`${item.label}-${item.at}`} className="flex items-center gap-3 text-sm">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    <span className="flex-1 text-slate-700">{item.label}</span>
                    <span className="font-mono text-xs text-slate-400">{format(new Date(item.at), "HH:mm:ss")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}