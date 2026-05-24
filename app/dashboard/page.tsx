'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { differenceInSeconds, format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Package,
  Play,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ProductData,
  ReservationData,
  confirmReservation,
  getProducts,
  getReservations,
  releaseReservation,
  reserveInventory,
} from "@/lib/api";

type Tab = "products" | "reservations" | "analytics" | "stress";
type BadgeVariant = "success" | "warning" | "danger" | "muted";

type ReserveTarget = {
  product: ProductData;
  inventory: ProductData["inventory"][number];
};

type StressResult = {
  id: number;
  status: number;
  ms: number;
  reservationId?: string;
};

function Badge({
  children,
  variant = "muted",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  const cls: Record<BadgeVariant, string> = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    muted: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-mono leading-none ${cls[variant]}`}>
      {children}
    </span>
  );
}

function statusVariant(status: ReservationData["status"]): BadgeVariant {
  if (status === "CONFIRMED") return "success";
  if (status === "PENDING") return "warning";
  return "muted";
}

function stockVariant(available: number, total: number): BadgeVariant {
  if (total === 0 || available === 0) return "danger";
  if (available <= 5 || available / total < 0.2) return "warning";
  return "success";
}

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

function ReservationRow({
  reservation,
  expanded,
  busy,
  onToggle,
  onConfirm,
  onRelease,
}: {
  reservation: ReservationData;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onRelease: () => void;
}) {
  const seconds = useCountdown(reservation.status === "PENDING" ? reservation.expiresAt : null);
  const expired = reservation.status === "PENDING" && seconds === 0;
  const productName = reservation.inventory?.product.name ?? "Unknown product";
  const warehouseName = reservation.inventory?.warehouse.name ?? "Unknown warehouse";

  const timeline = [
    { label: "Created", at: reservation.createdAt },
    ...(reservation.status === "CONFIRMED"
      ? [{ label: "Confirmed", at: reservation.updatedAt }]
      : []),
    ...(reservation.status === "RELEASED"
      ? [{ label: expired ? "Expired" : "Released", at: reservation.updatedAt }]
      : []),
  ];

  return (
    <div className="border-t border-border first:border-t-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">{reservation.id}</span>
            <Badge variant={expired ? "danger" : statusVariant(reservation.status)}>
              {expired ? "EXPIRED" : reservation.status}
            </Badge>
          </div>
          <div className="truncate text-sm font-medium text-slate-900">{productName}</div>
          <div className="text-xs text-slate-500">
            {warehouseName} - {reservation.quantity} unit{reservation.quantity !== 1 ? "s" : ""}
          </div>
        </div>

        {reservation.status === "PENDING" && (
          <span className={`font-mono text-xs ${seconds < 60 ? "text-red-500" : "text-amber-600"}`}>
            {expired
              ? "expired"
              : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
          </span>
        )}
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="space-y-4 bg-slate-50 px-4 py-4">
          {reservation.status === "PENDING" && (
            <div className={`flex items-center gap-2 rounded border px-3 py-2 text-xs ${expired ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              <Clock className="h-3.5 w-3.5" />
              {expired ? "Payment window is over. Cron cleanup will release it." : "Held while the customer completes payment."}
            </div>
          )}

          {reservation.status === "PENDING" && !expired && (
            <div className="flex gap-2">
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex h-8 items-center gap-1.5 rounded-sm bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirm payment
              </button>
              <button
                onClick={onRelease}
                disabled={busy}
                className="flex h-8 items-center gap-1.5 rounded-sm border border-border px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Release
              </button>
            </div>
          )}

          <a
            href={`/reservations/${reservation.id}`}
            className="inline-flex h-8 items-center rounded-sm border border-border px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-white"
          >
            Open checkout page
          </a>

          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Activity</div>
            <div className="space-y-2">
              {timeline.map((item) => (
                <div key={`${item.label}-${item.at}`} className="flex items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  <span className="flex-1 text-slate-700">{item.label}</span>
                  <span className="font-mono text-slate-400">{format(new Date(item.at), "HH:mm:ss")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<ProductData[]>([]);
  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedReservation, setExpandedReservation] = useState<string | null>(null);
  const [modal, setModal] = useState<ReserveTarget | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [stressInventoryId, setStressInventoryId] = useState("");
  const [stressCount, setStressCount] = useState(50);
  const [stressRunning, setStressRunning] = useState(false);
  const [stressResults, setStressResults] = useState<StressResult[] | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      const [nextProducts, nextReservations] = await Promise.all([
        getProducts(),
        getReservations(),
      ]);
      setProducts(nextProducts);
      setReservations(nextReservations);
      setLastSync(new Date());

      if (!stressInventoryId) {
        const firstAvailable = nextProducts.flatMap((product) => product.inventory)[0];
        if (firstAvailable) setStressInventoryId(firstAvailable.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stressInventoryId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void refresh().catch(() => {
        setError("Failed to load inventory");
      });
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => refresh(true), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const metrics = useMemo(() => {
    const totalStock = products.reduce(
      (sum, product) => sum + product.inventory.reduce((inner, item) => inner + item.totalStock, 0),
      0
    );
    const reservedStock = products.reduce(
      (sum, product) => sum + product.inventory.reduce((inner, item) => inner + item.reservedStock, 0),
      0
    );
    const confirmed = reservations.filter((reservation) => reservation.status === "CONFIRMED").length;
    const released = reservations.filter((reservation) => reservation.status === "RELEASED").length;
    return { totalStock, reservedStock, availableStock: totalStock - reservedStock, confirmed, released };
  }, [products, reservations]);

  const warehouseChartData = useMemo(() => {
    const map = new Map<string, { name: string; available: number; reserved: number }>();
    for (const product of products) {
      for (const item of product.inventory) {
        const current = map.get(item.warehouse.id) ?? {
          name: item.warehouse.name,
          available: 0,
          reserved: 0,
        };
        current.available += item.availableStock;
        current.reserved += item.reservedStock;
        map.set(item.warehouse.id, current);
      }
    }
    return Array.from(map.values());
  }, [products]);

  const stressTarget = products
    .flatMap((product) =>
      product.inventory.map((inventory) => ({
        product,
        inventory,
      }))
    )
    .find((item) => item.inventory.id === stressInventoryId);

  const stressStats = stressResults
    ? {
        success: stressResults.filter((result) => result.status === 201).length,
        conflict: stressResults.filter((result) => result.status === 409).length,
        other: stressResults.filter((result) => result.status !== 201 && result.status !== 409).length,
        avgMs: Math.round(stressResults.reduce((sum, result) => sum + result.ms, 0) / stressResults.length),
      }
    : null;

  async function handleReserve() {
    if (!modal) return;
    setError(null);
    setMessage(null);

    try {
      const reservation = await reserveInventory(
        modal.inventory.id,
        quantity,
        crypto.randomUUID()
      );
      setMessage("Reservation created. Complete payment within 10 minutes.");
      setModal(null);
      await refresh(true);
      router.push(`/reservations/${reservation.id}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to reserve inventory";
      setError(text === "INSUFFICIENT_STOCK" ? "That stock was just taken. Try another warehouse." : text);
      await refresh(true);
    }
  }

  async function handleConfirm(reservationId: string) {
    setBusyId(reservationId);
    setError(null);
    setMessage(null);

    try {
      await confirmReservation(reservationId);
      setMessage("Payment confirmed. Stock was permanently decremented.");
      await refresh(true);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to confirm reservation";
      setError(text === "RESERVATION_EXPIRED" ? "Reservation expired before payment completed." : text);
      await refresh(true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRelease(reservationId: string) {
    setBusyId(reservationId);
    setError(null);
    setMessage(null);

    try {
      await releaseReservation(reservationId);
      setMessage("Reservation released. Stock is available again.");
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release reservation");
      await refresh(true);
    } finally {
      setBusyId(null);
    }
  }

  async function runStressTest() {
    if (!stressTarget) return;
    setStressRunning(true);
    setStressResults(null);
    setError(null);
    setMessage(null);

    const payload = { inventoryId: stressTarget.inventory.id, quantity: 1 };
    const started = performance.now();

    const results = await Promise.all(
      Array.from({ length: stressCount }, async (_, index) => {
        const requestStarted = performance.now();
        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        return {
          id: index + 1,
          status: response.status,
          ms: Math.round(performance.now() - requestStarted),
          reservationId: typeof body.id === "string" ? body.id : undefined,
        };
      })
    );

    setStressResults(results);
    setMessage(`Stress test completed in ${Math.round(performance.now() - started)}ms.`);
    setStressRunning(false);
    await refresh(true);
  }

  function openReserve(product: ProductData, inventory: ProductData["inventory"][number]) {
    setModal({ product, inventory });
    setQuantity(1);
    setError(null);
    setMessage(null);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary">
                <Package className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">Allo Inventory</span>
            </div>
            <nav className="flex h-12">
              {[
                ["products", "Products"],
                ["reservations", `Reservations${reservations.length ? ` (${reservations.length})` : ""}`],
                ["analytics", "Analytics"],
                ["stress", "Stress Test"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key as Tab)}
                  className={`border-b-2 px-3 text-xs font-medium transition-colors ${
                    tab === key
                      ? "border-primary text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refresh(true)}
              disabled={refreshing}
              className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {lastSync ? format(lastSync, "HH:mm:ss") : "syncing"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-6 py-5">
        {error && (
          <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {message && (
          <div className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded border border-border bg-white">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {tab === "products" && (
              <section className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ["Total stock", metrics.totalStock.toLocaleString(), `${products.length} products`],
                    ["Available", metrics.availableStock.toLocaleString(), "ready to reserve"],
                    ["Reserved", metrics.reservedStock.toLocaleString(), "pending payment"],
                    ["Confirmed", metrics.confirmed.toString(), "paid reservations"],
                  ].map(([label, value, sub]) => (
                    <div key={label} className="rounded border border-border bg-white p-4">
                      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
                      <div className="font-mono text-2xl font-semibold">{value}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{sub}</div>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded border border-border bg-white">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-medium">Products</span>
                    <span className="font-mono text-[11px] text-slate-400">{products.length} items</span>
                  </div>

                  {products.map((product) => (
                    <div key={product.id} className="border-t border-border first:border-t-0">
                      <button
                        onClick={() =>
                          setExpandedProducts((current) => {
                            const next = new Set(current);
                            next.has(product.id) ? next.delete(product.id) : next.add(product.id);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
                      >
                        {expandedProducts.has(product.id) ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="flex-1 text-sm font-medium">{product.name}</span>
                        <Badge variant={product.inventory.some((item) => item.availableStock > 0) ? "success" : "danger"}>
                          {product.inventory.reduce((sum, item) => sum + item.availableStock, 0)} available
                        </Badge>
                      </button>

                      {expandedProducts.has(product.id) && (
                        <div className="bg-slate-50 px-4 pb-4">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-slate-400">
                                <th className="py-2 text-left font-medium">Warehouse</th>
                                <th className="py-2 text-center font-medium">Total</th>
                                <th className="py-2 text-center font-medium">Reserved</th>
                                <th className="py-2 text-center font-medium">Available</th>
                                <th className="py-2 text-center font-medium">Status</th>
                                <th className="py-2 text-right font-medium">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.inventory.map((item) => {
                                const alternative = product.inventory.find(
                                  (candidate) => candidate.id !== item.id && candidate.availableStock > 0
                                );

                                return (
                                  <tr key={item.id} className="border-b border-border/40 last:border-b-0">
                                    <td className="py-2 text-slate-700">{item.warehouse.name}</td>
                                    <td className="py-2 text-center font-mono text-slate-500">{item.totalStock}</td>
                                    <td className="py-2 text-center font-mono text-slate-500">{item.reservedStock}</td>
                                    <td className="py-2 text-center font-mono font-semibold">{item.availableStock}</td>
                                    <td className="py-2 text-center">
                                      <Badge variant={stockVariant(item.availableStock, item.totalStock)}>
                                        {item.availableStock === 0 ? "Empty" : item.availableStock <= 5 ? "Low" : "Stock"}
                                      </Badge>
                                    </td>
                                    <td className="py-2 text-right">
                                      {item.availableStock > 0 ? (
                                        <button
                                          onClick={() => openReserve(product, item)}
                                          className="rounded-sm bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                                        >
                                          Reserve
                                        </button>
                                      ) : alternative ? (
                                        <button
                                          onClick={() => openReserve(product, alternative)}
                                          className="rounded-sm border border-border px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-white"
                                        >
                                          Try {alternative.warehouse.name}
                                        </button>
                                      ) : (
                                        <span className="text-slate-300">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {tab === "reservations" && (
              <section className="overflow-hidden rounded border border-border bg-white">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-medium">Reservation checkout</span>
                  <div className="flex gap-2">
                    <Badge variant="warning">{reservations.filter((item) => item.status === "PENDING").length} pending</Badge>
                    <Badge variant="success">{metrics.confirmed} confirmed</Badge>
                    <Badge>{metrics.released} released</Badge>
                  </div>
                </div>

                {reservations.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-400">No reservations yet</div>
                ) : (
                  reservations.map((reservation) => (
                    <ReservationRow
                      key={reservation.id}
                      reservation={reservation}
                      expanded={expandedReservation === reservation.id}
                      busy={busyId === reservation.id}
                      onToggle={() =>
                        setExpandedReservation(expandedReservation === reservation.id ? null : reservation.id)
                      }
                      onConfirm={() => handleConfirm(reservation.id)}
                      onRelease={() => handleRelease(reservation.id)}
                    />
                  ))
                )}
              </section>
            )}

            {tab === "analytics" && (
              <section className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ["Total inventory", metrics.totalStock.toLocaleString()],
                    ["Reserved inventory", metrics.reservedStock.toLocaleString()],
                    ["Confirmed", metrics.confirmed.toString()],
                    ["Released/expired", metrics.released.toString()],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded border border-border bg-white p-4">
                      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
                      <div className="font-mono text-2xl font-semibold">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded border border-border bg-white p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                    <BarChart3 className="h-4 w-4 text-slate-400" />
                    Warehouse utilization
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={warehouseChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="available" stackId="stock" fill="#10b981" />
                      <Bar dataKey="reserved" stackId="stock" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {tab === "stress" && (
              <section className="space-y-4">
                <div className="rounded border border-border bg-white p-5">
                  <div className="mb-1 text-sm font-medium">Concurrent reservation probe</div>
                  <p className="mb-4 max-w-2xl text-xs text-slate-500">
                    This sends real concurrent POST requests to the reservation API. The database lock decides which requests win.
                  </p>

                  <div className="grid gap-3 md:grid-cols-[1fr_160px_140px]">
                    <select
                      value={stressInventoryId}
                      onChange={(event) => setStressInventoryId(event.target.value)}
                      className="h-9 rounded border border-border bg-white px-3 text-sm"
                    >
                      {products.flatMap((product) =>
                        product.inventory.map((item) => (
                          <option key={item.id} value={item.id}>
                            {product.name} - {item.warehouse.name} ({item.availableStock} available)
                          </option>
                        ))
                      )}
                    </select>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={stressCount}
                      onChange={(event) => setStressCount(Math.max(2, Math.min(100, Number(event.target.value) || 50)))}
                      className="h-9 rounded border border-border px-3 text-sm"
                    />
                    <button
                      onClick={runStressTest}
                      disabled={stressRunning || !stressInventoryId}
                      className="flex h-9 items-center justify-center gap-2 rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {stressRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Run test
                    </button>
                  </div>
                </div>

                {stressStats && stressResults && (
                  <>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        ["Succeeded", stressStats.success.toString(), "text-emerald-600"],
                        ["409 conflicts", stressStats.conflict.toString(), "text-red-500"],
                        ["Other responses", stressStats.other.toString(), "text-slate-600"],
                        ["Average latency", `${stressStats.avgMs}ms`, "text-slate-900"],
                      ].map(([label, value, color]) => (
                        <div key={label} className="rounded border border-border bg-white p-4">
                          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
                          <div className={`font-mono text-2xl font-semibold ${color}`}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="overflow-hidden rounded border border-border bg-white">
                      <div className="border-b border-border px-4 py-3 text-sm font-medium">Request log</div>
                      <div className="max-h-72 overflow-y-auto">
                        {stressResults.map((result) => (
                          <div key={result.id} className="flex items-center gap-3 border-b border-border/50 px-4 py-2 text-xs last:border-b-0">
                            {result.status === 201 ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : result.status === 409 ? (
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            )}
                            <span className="w-16 font-mono text-slate-400">REQ-{String(result.id).padStart(3, "0")}</span>
                            <span className="flex-1 text-slate-700">{result.status === 201 ? "201 Created" : result.status === 409 ? "409 Conflict" : result.status}</span>
                            <span className="font-mono text-slate-400">{result.ms}ms</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <div className="w-full max-w-sm rounded border border-border bg-white shadow-lg">
            <div className="flex items-start justify-between px-5 pt-5">
              <div>
                <div className="text-sm font-medium">Reserve inventory</div>
                <div className="mt-0.5 text-xs text-slate-500">{modal.inventory.warehouse.name}</div>
              </div>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="divide-y divide-border/60 rounded border border-border/60 bg-slate-50">
                {[
                  ["Product", modal.product.name],
                  ["Warehouse", modal.inventory.warehouse.name],
                  ["Available", `${modal.inventory.availableStock} units`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-900">{value}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-500">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-slate-600 hover:bg-slate-50"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={modal.inventory.availableStock}
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(Math.max(1, Math.min(modal.inventory.availableStock, Number(event.target.value) || 1)))
                    }
                    className="h-8 w-16 rounded-sm border border-border text-center font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => setQuantity((current) => Math.min(modal.inventory.availableStock, current + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-slate-600 hover:bg-slate-50"
                  >
                    +
                  </button>
                  <span className="ml-1 text-xs text-slate-400">of {modal.inventory.availableStock}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                Held for 10 minutes with an idempotency key.
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setModal(null)}
                className="h-8 flex-1 rounded-sm border border-border text-xs text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReserve}
                className="h-8 flex-1 rounded-sm bg-primary text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Confirm reservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
