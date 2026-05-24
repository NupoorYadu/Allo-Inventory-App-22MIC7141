'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock3, RefreshCw, X, ArrowRight } from "lucide-react";

import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/shared/badge";
import { MetricCard, Panel, ProgressRail, SectionTitle } from "@/components/platform-ui";
import { confirmReservation, getReservations, releaseReservation, ReservationData } from "@/lib/api";
import { summarizeDashboard } from "@/lib/platform";

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

function ReservationTile({ reservation, onConfirm, onRelease }: { reservation: ReservationData; onConfirm: () => void; onRelease: () => void }) {
  const seconds = useCountdown(reservation.status === "PENDING" ? reservation.expiresAt : null);
  const expired = reservation.status === "PENDING" && seconds === 0;
  const tone = expired ? "danger" : reservation.status === "CONFIRMED" ? "success" : reservation.status === "PENDING" ? "warning" : "muted";

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={tone}>{expired ? "expired" : reservation.status.toLowerCase()}</Badge>
            {reservation.status === "PENDING" && <span className="font-mono text-xs text-slate-400">{seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "0:00"}</span>}
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950">{reservation.inventory?.product.name ?? "Unknown product"}</div>
          <div className="text-sm text-slate-500">{reservation.inventory?.warehouse.name ?? "Unknown warehouse"} · {reservation.quantity} unit{reservation.quantity !== 1 ? "s" : ""}</div>
        </div>
        <Link href={`/reservations/${reservation.id}`} className="inline-flex h-9 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700">
          Checkout <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 space-y-2 text-xs text-slate-500">
        <div className="flex items-center justify-between"><span>Reservation ID</span><span className="font-mono">{reservation.id.slice(0, 12)}...</span></div>
        <div className="flex items-center justify-between"><span>Expires</span><span>{new Date(reservation.expiresAt).toLocaleTimeString()}</span></div>
        <ProgressRail value={seconds} max={600} tone={expired ? "rose" : "amber"} />
      </div>

      {reservation.status === "PENDING" && !expired && (
        <div className="mt-4 flex gap-2">
          <button onClick={onConfirm} className="inline-flex h-9 items-center gap-2 rounded-2xl bg-emerald-600 px-3 text-sm font-medium text-white transition hover:bg-emerald-700"><Check className="h-4 w-4" /> Confirm</button>
          <button onClick={onRelease} className="inline-flex h-9 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:text-rose-700"><X className="h-4 w-4" /> Release</button>
        </div>
      )}
    </div>
  );
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    const nextReservations = await getReservations();
    setReservations(nextReservations);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setRefreshing(true);
        const nextReservations = await getReservations();
        if (!active) return;
        setReservations(nextReservations);
      } finally {
        if (active) setRefreshing(false);
      }
    };

    void load();
    const timer = window.setInterval(() => refresh(true), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const summary = useMemo(() => summarizeDashboard([], reservations), [reservations]);

  async function handleConfirm(id: string) {
    setBusy(id);
    await confirmReservation(id);
    await refresh(true);
    setBusy(null);
  }

  async function handleRelease(id: string) {
    setBusy(id);
    await releaseReservation(id);
    await refresh(true);
    setBusy(null);
  }

  return (
    <PlatformShell
      eyebrow="Reservations"
      title="Reservation control tower"
      description="Track active holds, confirm payments, release stock, and inspect the lifecycle of each reservation in one place."
      actions={<><Badge variant="muted">{refreshing ? "syncing" : "live"}</Badge><button onClick={() => refresh(true)} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button></>}
    >
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pending holds" value={summary.activeReservations} detail="Waiting on payment" accent="amber" />
        <MetricCard label="Confirmed" value={summary.confirmedReservations} detail="Stock decremented permanently" accent="emerald" />
        <MetricCard label="Released" value={summary.releasedReservations} detail="Released back to availability" accent="slate" />
        <MetricCard label="Expired cleanup" value={summary.expiredReservations} detail="Automated release backlog" accent="rose" />
      </section>

      <Panel>
        <SectionTitle eyebrow="Queue" title="Latest reservations" description="The newest reservations appear first so operators can act before the payment window closes." />
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {reservations.slice(0, 12).map((reservation) => (
            <ReservationTile key={reservation.id} reservation={reservation} onConfirm={() => handleConfirm(reservation.id)} onRelease={() => handleRelease(reservation.id)} />
          ))}
        </div>
      </Panel>
    </PlatformShell>
  );
}
