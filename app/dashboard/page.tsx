'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  RefreshCw,
  ChevronRight,
  Play,
} from "lucide-react";

import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/shared/badge";
import { AnimatedNumber, LiveDot, MetricCard, Panel, ProductThumbnail, ProgressRail, SectionTitle } from "@/components/platform-ui";
import { getProducts, getReservations, ProductData, ReservationData } from "@/lib/api";
import { buildActivityFeed, buildLowStockItems, buildWarehouseSeries, flattenInventory, summarizeDashboard } from "@/lib/platform";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function toneVariant(available: number, total: number) {
  if (total === 0 || available === 0) return "danger";
  if (available <= 5 || available / total < 0.2) return "warning";
  return "success";
}

function ProductCard({ product }: { product: ProductData }) {
  const total = product.inventory.reduce((sum, item) => sum + item.totalStock, 0);
  const reserved = product.inventory.reduce((sum, item) => sum + item.reservedStock, 0);
  const available = total - reserved;

  return (
    <div className="group rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-4">
        <ProductThumbnail name={product.name} sku={`SKU-${product.id.slice(-4).toUpperCase()}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight text-slate-950">{product.name}</h3>
            <Badge variant={toneVariant(available, total)}> {available === 0 ? "out" : available <= 5 ? "watch" : "healthy"} </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{product.inventory.length} warehouse lanes live</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-2xl bg-slate-50 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Total</div>
              <div className="mt-1 font-mono text-slate-900">{compact.format(total)}</div>
            </div>
            <div className="rounded-2xl bg-amber-50/70 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-amber-700">Reserved</div>
              <div className="mt-1 font-mono text-amber-800">{compact.format(reserved)}</div>
            </div>
            <div className="rounded-2xl bg-emerald-50/70 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">Available</div>
              <div className="mt-1 font-mono text-emerald-800">{compact.format(available)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 border-t border-slate-200/70 pt-4">
        {product.inventory.map((inventory) => (
          <div key={inventory.id} className="space-y-2 rounded-2xl bg-slate-50/80 p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-950">{inventory.warehouse.name}</div>
                <div className="text-xs text-slate-500">{inventory.availableStock} available · {inventory.reservedStock} reserved</div>
              </div>
              <Badge variant={toneVariant(inventory.availableStock, inventory.totalStock)}>
                {inventory.availableStock === 0 ? "critical" : inventory.availableStock <= 5 ? "tight" : "ok"}
              </Badge>
            </div>
            <ProgressRail value={inventory.availableStock} max={Math.max(1, inventory.totalStock)} tone={inventory.availableStock === 0 ? "rose" : inventory.availableStock <= 5 ? "amber" : "emerald"} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      const [nextProducts, nextReservations] = await Promise.all([getProducts(), getReservations()]);
      setProducts(nextProducts);
      setReservations(nextReservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const [nextProducts, nextReservations] = await Promise.all([getProducts(), getReservations()]);
        if (!active) return;
        setProducts(nextProducts);
        setReservations(nextReservations);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to refresh dashboard");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => refresh(true), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const summary = useMemo(() => summarizeDashboard(products, reservations), [products, reservations]);
  const warehouseSeries = useMemo(() => buildWarehouseSeries(products), [products]);
  const lowStockItems = useMemo(() => buildLowStockItems(products), [products]);
  const activity = useMemo(() => buildActivityFeed(reservations), [reservations]);
  const inventoryRows = useMemo(() => flattenInventory(products), [products]);

  return (
    <PlatformShell
      eyebrow="Operations dashboard"
      title="Inventory command center"
      description="A live view of stock allocation, reservation pressure, warehouse health, and cleanup posture across the platform."
      actions={
        <>
          <LiveDot label={refreshing ? "syncing" : "live polling"} />
          <button onClick={() => refresh(true)} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link href="/simulator" className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800">
            Run simulator <Play className="h-4 w-4" />
          </Link>
        </>
      }
    >
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total inventory" value={<AnimatedNumber value={summary.totalStock} className="tabular-nums" />} detail="Across all warehouses" accent="blue" />
        <MetricCard label="Reserved inventory" value={<AnimatedNumber value={summary.reservedStock} className="tabular-nums" />} detail="Held for pending checkouts" accent="amber" />
        <MetricCard label="Active reservations" value={<AnimatedNumber value={summary.activeReservations} className="tabular-nums" />} detail="Customers in payment flow" accent="emerald" />
        <MetricCard label="Low-stock SKUs" value={<AnimatedNumber value={summary.lowStockCount} className="tabular-nums" />} detail="Needs replenishment review" accent="rose" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <Panel>
          <SectionTitle
            eyebrow="Warehouse utilization"
            title="Realtime inventory posture"
            description="Reserved stock sits in amber while available stock remains intentionally visible for operational decision-making."
            actions={<Badge variant="muted">updated just now</Badge>}
          />
          <div className="h-[380px] p-4 sm:p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={warehouseSeries} margin={{ top: 20, right: 18, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="#64748b" />
                <YAxis tickLine={false} axisLine={false} stroke="#64748b" />
                <Tooltip cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} contentStyle={{ borderRadius: 16, border: "1px solid rgb(226 232 240)", boxShadow: "0 18px 34px rgba(15,23,42,0.08)" }} />
                <Bar dataKey="available" stackId="a" fill="#0f766e" radius={[10, 10, 0, 0]} />
                <Bar dataKey="reserved" stackId="a" fill="#f59e0b" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionTitle
            eyebrow="Operational alerts"
            title="Low-stock pressure"
            description="The list below highlights SKUs that are close to becoming constrained."
          />
          <div className="space-y-3 p-4 sm:p-5">
            {lowStockItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center text-sm text-slate-500">No immediate stock pressure. The platform is healthy.</div>
            ) : (
              lowStockItems.map(({ product, inventory }) => (
                <div key={inventory.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <ProductThumbnail name={product.name} sku={`SKU-${product.id.slice(-4).toUpperCase()}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="truncate font-semibold text-slate-950">{product.name}</div>
                          <div className="text-sm text-slate-500">{inventory.warehouse.name}</div>
                        </div>
                        <Badge variant={inventory.availableStock === 0 ? "danger" : inventory.availableStock <= 5 ? "warning" : "success"}>{inventory.availableStock === 0 ? "critical" : "watch"}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                        <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="uppercase tracking-[0.18em] text-slate-400">Available</div><div className="mt-1 font-mono text-base text-slate-950">{inventory.availableStock}</div></div>
                        <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="uppercase tracking-[0.18em] text-slate-400">Reserved</div><div className="mt-1 font-mono text-base text-slate-950">{inventory.reservedStock}</div></div>
                        <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="uppercase tracking-[0.18em] text-slate-400">Health</div><div className="mt-1 font-mono text-base text-slate-950">{Math.round((inventory.availableStock / Math.max(1, inventory.totalStock)) * 100)}%</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <SectionTitle eyebrow="Product lanes" title="Inventory by product" description="Each lane shows how much stock is still available per warehouse and where pressure is building." />
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <SectionTitle eyebrow="Activity feed" title="Reservation lifecycle" description="New reservations, confirmations, releases, and expirations sorted by most recent state changes." actions={<Badge variant="muted">{reservations.length} events</Badge>} />
            <div className="space-y-3 p-4">
              {activity.map((reservation) => (
                <Link href={`/reservations/${reservation.id}`} key={reservation.id} className="group block rounded-2xl border border-slate-200/80 bg-white/90 p-4 transition hover:border-teal-200 hover:shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={reservation.expired ? "danger" : reservation.status === "CONFIRMED" ? "success" : reservation.status === "PENDING" ? "warning" : "muted"}>{reservation.expired ? "expired" : reservation.status.toLowerCase()}</Badge>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{reservation.ageLabel}</span>
                      </div>
                      <div className="mt-2 truncate font-semibold text-slate-950">{reservation.productName}</div>
                      <div className="mt-1 text-sm text-slate-500">{reservation.warehouseName} · {reservation.quantity} unit{reservation.quantity !== 1 ? "s" : ""}</div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 text-slate-300 transition group-hover:text-teal-600" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono">{reservation.id.slice(0, 12)}...</span>
                    <span>{format(new Date(reservation.updatedAt), "HH:mm:ss")}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle eyebrow="Operational posture" title="Signal summary" description="These numbers communicate the current pressure in the reservation system." />
            <div className="grid gap-3 p-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><div><div className="text-sm font-medium text-slate-950">{summary.confirmedReservations} confirmed</div><div className="text-xs text-slate-500">Permanent stock decrements</div></div><Badge variant="success">confirmed</Badge></div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><div><div className="text-sm font-medium text-slate-950">{summary.releasedReservations} released</div><div className="text-xs text-slate-500">Released or cancelled reservations</div></div><Badge variant="muted">released</Badge></div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><div><div className="text-sm font-medium text-slate-950">{summary.expiredReservations} expired</div><div className="text-xs text-slate-500">Expired holds awaiting cleanup</div></div><Badge variant="warning">cleanup</Badge></div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <SectionTitle eyebrow="Inventory overview" title="All lanes at a glance" description="A compact operational table for confirming where stock is concentrated and where it is constrained." />
        <div className="overflow-hidden">
          <div className="grid grid-cols-[1.4fr_.9fr_.9fr_.8fr] gap-4 border-b border-slate-200/80 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
            <div>Product</div>
            <div>Warehouse</div>
            <div>Status</div>
            <div className="text-right">Available</div>
          </div>
          {inventoryRows.map(({ product, inventory }) => (
            <div key={inventory.id} className="grid grid-cols-[1.4fr_.9fr_.9fr_.8fr] items-center gap-4 border-b border-slate-200/60 px-5 py-4 last:border-b-0">
              <div className="flex items-center gap-3">
                <ProductThumbnail name={product.name} sku={`SKU-${product.id.slice(-4).toUpperCase()}`} />
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-950">{product.name}</div>
                  <div className="font-mono text-xs text-slate-400">{inventory.id.slice(0, 10)}...</div>
                </div>
              </div>
              <div className="text-sm text-slate-600">{inventory.warehouse.name}</div>
              <div>
                <Badge variant={toneVariant(inventory.availableStock, inventory.totalStock)}>{inventory.availableStock <= 0 ? "blocked" : inventory.availableStock <= 5 ? "watch" : "healthy"}</Badge>
              </div>
              <div className="text-right font-mono text-sm text-slate-950">{inventory.availableStock}</div>
            </div>
          ))}
        </div>
      </Panel>
    </PlatformShell>
  );
}
