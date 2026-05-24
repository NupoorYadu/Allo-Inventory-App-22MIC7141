'use client';

import { useEffect, useState } from "react";
import { Activity, DatabaseZap, Radar, TimerReset } from "lucide-react";

import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/shared/badge";
import { MetricCard, Panel, SectionTitle } from "@/components/platform-ui";
import { buildSystemHealthSignals } from "@/lib/platform";

export default function SystemHealthPage() {
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [reservationLatency, setReservationLatency] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function probe() {
      const startedProducts = performance.now();
      await fetch("/api/products");
      const productsMs = Math.round(performance.now() - startedProducts);

      const startedReservations = performance.now();
      await fetch("/api/reservations");
      const reservationsMs = Math.round(performance.now() - startedReservations);

      if (!mounted) return;
      setApiLatency(productsMs);
      setReservationLatency(reservationsMs);
    }

    void probe();
    const timer = window.setInterval(probe, 8000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const signals = buildSystemHealthSignals();

  return (
    <PlatformShell eyebrow="System health" title="Infrastructure signal board" description="A DevOps-inspired page for inspecting cron, polling, API response time, and sync health.">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="API latency" value={`${apiLatency ?? 0} ms`} detail="Products endpoint round-trip" accent="blue" />
        <MetricCard label="Reservations latency" value={`${reservationLatency ?? 0} ms`} detail="Reservation feed round-trip" accent="emerald" />
        <MetricCard label="Cleanup window" value="1 min" detail="Cron release cadence in production" accent="amber" />
        <MetricCard label="Polling sync" value="5 s" detail="Dashboard refresh cadence" accent="violet" />
      </section>

      <Panel>
        <SectionTitle eyebrow="Service health" title="Core runtime systems" description="These signals describe the operational posture of the application without pretending to be a full observability stack." />
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          {signals.map((signal) => (
            <div key={signal.label} className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{signal.label}</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{signal.value}</div>
              <div className="mt-2 text-sm text-slate-500">{signal.detail}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <SectionTitle eyebrow="Checks" title="Operational guarantees" />
          <div className="space-y-3 p-5 text-sm text-slate-600">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"><DatabaseZap className="h-4 w-4 text-teal-700" />Database writes stay inside Prisma transactions.</div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"><Activity className="h-4 w-4 text-blue-700" />Polling keeps the UI fresh without additional runtime services.</div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"><TimerReset className="h-4 w-4 text-amber-700" />Expired reservations are reclaimed by scheduled cleanup.</div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4"><Radar className="h-4 w-4 text-violet-700" />The simulator validates oversell prevention under burst load.</div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle eyebrow="Transport" title="Realtime posture" />
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><span className="text-sm text-slate-600">Transport</span><Badge variant="success">polling</Badge></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><span className="text-sm text-slate-600">Cleanup job</span><Badge variant="warning">healthy</Badge></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><span className="text-sm text-slate-600">Database</span><Badge variant="success">connected</Badge></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><span className="text-sm text-slate-600">Web clients</span><Badge variant="muted">session local</Badge></div>
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionTitle eyebrow="Runbook" title="What happens when something drifts" />
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {[
            "If stock feels stale, refresh the dashboard or wait for the next poll.",
            "If pending reservations pile up, the cron endpoint drains expired holds automatically.",
            "If concurrent requests spike, the simulator should still show 409s instead of oversells.",
          ].map((item) => (
            <div key={item} className="rounded-[24px] border border-slate-200/80 bg-white p-5 text-sm text-slate-600">{item}</div>
          ))}
        </div>
      </Panel>
    </PlatformShell>
  );
}
