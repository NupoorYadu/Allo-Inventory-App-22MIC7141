'use client';

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowUpRight, Shield, Warehouse } from "lucide-react";

import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/shared/badge";
import { MetricCard, Panel, SectionTitle } from "@/components/platform-ui";
import { getProducts, getReservations, ProductData, ReservationData } from "@/lib/api";
import { buildWarehouseSeries, summarizeDashboard } from "@/lib/platform";

export default function AnalyticsPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [reservations, setReservations] = useState<ReservationData[]>([]);

  useEffect(() => {
    void Promise.all([getProducts(), getReservations()]).then(([nextProducts, nextReservations]) => {
      setProducts(nextProducts);
      setReservations(nextReservations);
    });
  }, []);

  const summary = useMemo(() => summarizeDashboard(products, reservations), [products, reservations]);
  const warehouseSeries = useMemo(() => buildWarehouseSeries(products), [products]);
  const conversionRate = reservations.length === 0 ? 0 : Math.round((summary.confirmedReservations / reservations.length) * 100);

  const statusSeries = [
    { name: "Pending", value: summary.activeReservations },
    { name: "Confirmed", value: summary.confirmedReservations },
    { name: "Released", value: summary.releasedReservations },
  ];

  return (
    <PlatformShell eyebrow="Analytics" title="Operational analytics" description="A compact executive layer for understanding reservation conversion, warehouse load, and inventory health.">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Reservation conversion" value={`${conversionRate}%`} detail="Confirmed reservations / total reservations" accent="emerald" />
        <MetricCard label="Warehouse utilization" value={`${Math.round((summary.reservedStock / Math.max(1, summary.totalStock)) * 100)}%`} detail="Reserved against total stock" accent="blue" />
        <MetricCard label="Expired backlog" value={summary.expiredReservations} detail="Expired holds awaiting release" accent="amber" />
        <MetricCard label="Healthy stock lanes" value={products.reduce((sum, product) => sum + product.inventory.filter((item) => item.availableStock > 5).length, 0)} detail="Operationally comfortable lanes" accent="slate" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <Panel>
          <SectionTitle eyebrow="Utilization" title="Warehouse capacity" description="How reserved and available inventory are distributed across each warehouse." />
          <div className="h-[340px] p-4 sm:p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={warehouseSeries} margin={{ top: 20, right: 18, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="#64748b" />
                <YAxis tickLine={false} axisLine={false} stroke="#64748b" />
                <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid rgb(226 232 240)" }} />
                <Bar dataKey="available" stackId="a" fill="#0f766e" radius={[10, 10, 0, 0]} />
                <Bar dataKey="reserved" stackId="a" fill="#f59e0b" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionTitle eyebrow="Reservation state" title="Lifecycle mix" description="The distribution of pending, confirmed, and released states currently in the system." />
          <div className="space-y-3 p-5">
            {statusSeries.map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="font-medium text-slate-950">{item.name}</div>
                  <Badge variant={item.name === "Confirmed" ? "success" : item.name === "Pending" ? "warning" : "muted"}>{item.value}</Badge>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${item.name === "Confirmed" ? "bg-emerald-500" : item.name === "Pending" ? "bg-amber-500" : "bg-slate-400"}`} style={{ width: `${Math.max(4, Math.min(100, item.value * 12))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionTitle eyebrow="Executive summary" title="System-level indicators" />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm"><Warehouse className="h-5 w-5 text-teal-700" /><div className="mt-3 text-sm font-medium text-slate-950">Warehouse drift</div><div className="mt-1 text-sm text-slate-500">Each warehouse remains inside a predictable allocation band.</div></div>
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm"><Activity className="h-5 w-5 text-blue-700" /><div className="mt-3 text-sm font-medium text-slate-950">Realtime pressure</div><div className="mt-1 text-sm text-slate-500">Polling keeps the UI aligned with the latest server state.</div></div>
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm"><Shield className="h-5 w-5 text-emerald-700" /><div className="mt-3 text-sm font-medium text-slate-950">Transaction safety</div><div className="mt-1 text-sm text-slate-500">Idempotency keys keep retries safe under concurrency.</div></div>
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm"><ArrowUpRight className="h-5 w-5 text-violet-700" /><div className="mt-3 text-sm font-medium text-slate-950">Conversion signal</div><div className="mt-1 text-sm text-slate-500">Confirmed reservations are the cleanest signal of checkout success.</div></div>
        </div>
      </Panel>
    </PlatformShell>
  );
}
