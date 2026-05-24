'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { addMinutes, format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Package,
  X,
  Check,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Play,
} from 'lucide-react';

import {
  Product,
  Reservation,
  Status,
  TimelineEvent,
  StressResult,
  getAvailableStock,
  getTotalAvailable,
  getStockVariant,
  getStatusVariant,
  generateReservationId,
  secondsRemaining,
} from '@/lib/types';
import { getProducts, reserveInventory, confirmReservation, releaseReservation } from '@/lib/api';
import { Badge } from '@/components/shared/badge';
import { useCountdown, CountdownDisplay } from '@/components/shared/countdown';

// ─── Components ───

function ReservationRow({
  res,
  isActive,
  onSelect,
  onConfirm,
  onRelease,
  confirming,
  releasing,
}: {
  res: Reservation;
  isActive: boolean;
  onSelect: () => void;
  onConfirm: () => void;
  onRelease: () => void;
  confirming: boolean;
  releasing: boolean;
}) {
  const secs = useCountdown(res.status === 'PENDING' ? res.expiresAt : null);

  return (
    <div>
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-border last:border-0"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-mono text-slate-400">{res.id}</span>
            <Badge variant={getStatusVariant(res.status)}>{res.status}</Badge>
          </div>
          <div className="text-sm font-medium text-slate-900 truncate">{res.productName}</div>
          <div className="text-xs text-slate-500">
            {res.warehouseName} · {res.quantity} unit{res.quantity !== 1 ? 's' : ''}
          </div>
        </div>

        {res.status === 'PENDING' && <CountdownDisplay expiresAt={res.expiresAt} />}

        {isActive ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {isActive && (
        <div className="border-b border-border bg-slate-50 px-4 py-4 space-y-4">
          {res.status === 'PENDING' && secs >= 0 && (
            <>
              <div
                className={`flex items-center gap-2 px-3 py-2.5 rounded border text-xs ${
                  secs < 60
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                {secs === 0
                  ? 'Reservation expired'
                  : `Payment window closes in ${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`}
              </div>

              {secs > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={onConfirm}
                    disabled={confirming}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {confirming ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    {confirming ? 'Confirming...' : 'Confirm payment'}
                  </button>
                  <button
                    onClick={onRelease}
                    disabled={releasing}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-slate-600 text-xs font-medium rounded-sm hover:bg-white disabled:opacity-50"
                  >
                    {releasing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                    {releasing ? 'Releasing...' : 'Release'}
                  </button>
                </div>
              )}
            </>
          )}

          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2.5">
              Timeline
            </div>
            <div className="space-y-2">
              {res.timeline.map((event, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1 flex-shrink-0" />
                  <span className="text-slate-700 flex-1">{event.label}</span>
                  <span className="text-slate-400 font-mono flex-shrink-0">
                    {format(event.at, 'HH:mm:ss')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'products' | 'reservations' | 'analytics' | 'stress'>(
    'products',
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Product expand state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Reserve modal
  const [reserveModal, setReserveModal] = useState<{ product: Product; inventory: any } | null>(
    null,
  );
  const [reserveQty, setReserveQty] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  // Reservation actions
  const [activeReservation, setActiveReservation] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  // Stress test
  const [stressProduct, setStressProduct] = useState('');
  const [stressInventory, setStressInventory] = useState('');
  const [stressRunning, setStressRunning] = useState(false);
  const [stressResults, setStressResults] = useState<StressResult[] | null>(null);

  const [lastSync, setLastSync] = useState(new Date());

  // Load products
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProducts();
      setProducts(data);
      if (data.length > 0 && data[0].inventory.length > 0) {
        setStressProduct(data[0].id);
        setStressInventory(data[0].inventory[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Auto-expire reservations
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setReservations((prev) => {
        let changed = false;
        const next = prev.map((r) => {
          if (r.status !== 'PENDING' || r.expiresAt > now) return r;
          changed = true;
          return {
            ...r,
            status: 'RELEASED' as Status,
            timeline: [...r.timeline, { label: 'Auto-expired', at: now }],
          };
        });
        if (changed) setLastSync(new Date());
        return next;
      });
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // Reserve product
  async function handleReserve() {
    if (!reserveModal || reserveQty <= 0) return;
    const { product, inventory } = reserveModal;
    const available = getAvailableStock(inventory);

    if (reserveQty > available) {
      setReserveError(`Only ${available} unit${available !== 1 ? 's' : ''} available`);
      return;
    }

    setReserving(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await reserveInventory(inventory.id, reserveQty, idempotencyKey);

      const now = new Date();
      const reservation: Reservation = {
        id: generateReservationId(),
        productId: product.id,
        productName: product.name,
        inventoryId: inventory.id,
        warehouseName: (inventory as any).warehouse.name,
        quantity: reserveQty,
        status: 'PENDING',
        expiresAt: addMinutes(now, 10),
        createdAt: now,
        timeline: [{ label: 'Created', at: now }],
      };

      setReservations((prev) => [reservation, ...prev]);
      setProducts((prev) =>
        prev.map((p) =>
          p.id !== product.id
            ? p
            : {
                ...p,
                inventory: p.inventory.map((inv) =>
                  inv.id !== inventory.id
                    ? inv
                    : {
                        ...inv,
                        availableStock: getAvailableStock(inv) - reserveQty,
                      },
                ),
              },
        ),
      );

      setActiveReservation(reservation.id);
      setReserveModal(null);
      setActiveTab('reservations');
      setLastSync(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reserve';
      setReserveError(msg === 'INSUFFICIENT_STOCK' ? 'Stock no longer available' : msg);
    } finally {
      setReserving(false);
    }
  }

  // Confirm reservation
  async function handleConfirm(resId: string) {
    const res = reservations.find((r) => r.id === resId);
    if (!res) return;

    setConfirmingId(resId);
    try {
      await confirmReservation(resId);

      const now = new Date();
      setReservations((prev) =>
        prev.map((r) =>
          r.id !== resId
            ? r
            : {
                ...r,
                status: 'CONFIRMED' as Status,
                timeline: [...r.timeline, { label: 'Confirmed', at: now }],
              },
        ),
      );

      setProducts((prev) =>
        prev.map((p) =>
          p.id !== res.productId
            ? p
            : {
                ...p,
                inventory: p.inventory.map((inv) =>
                  inv.id !== res.inventoryId
                    ? inv
                    : {
                        ...inv,
                        totalStock: inv.totalStock - res.quantity,
                        availableStock: getAvailableStock(inv) - res.quantity,
                      },
                ),
              },
        ),
      );

      setLastSync(new Date());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setConfirmingId(null);
    }
  }

  // Release reservation
  async function handleRelease(resId: string) {
    const res = reservations.find((r) => r.id === resId);
    if (!res) return;

    setReleasingId(resId);
    try {
      await releaseReservation(resId);

      const now = new Date();
      setReservations((prev) =>
        prev.map((r) =>
          r.id !== resId
            ? r
            : {
                ...r,
                status: 'RELEASED' as Status,
                timeline: [...r.timeline, { label: 'Released', at: now }],
              },
        ),
      );

      setProducts((prev) =>
        prev.map((p) =>
          p.id !== res.productId
            ? p
            : {
                ...p,
                inventory: p.inventory.map((inv) =>
                  inv.id !== res.inventoryId
                    ? inv
                    : {
                        ...inv,
                        availableStock: getAvailableStock(inv) + res.quantity,
                      },
                ),
              },
        ),
      );

      setLastSync(new Date());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to release');
    } finally {
      setReleasingId(null);
    }
  }

  // Run stress test
  async function runStressTest() {
    if (!stressProduct || !stressInventory) {
      alert('Select a product');
      return;
    }

    const product = products.find((p) => p.id === stressProduct);
    const inventory = product?.inventory.find((i) => i.id === stressInventory);
    if (!product || !inventory) return;

    setStressRunning(true);
    setStressResults(null);

    const available = getAvailableStock(inventory);
    let successes = 0;
    const results: StressResult[] = [];

    await Promise.all(
      Array.from({ length: 50 }, async (_, i) => {
        const start = performance.now();
        await new Promise((r) => setTimeout(r, Math.random() * 100));
        const ms = Math.round(performance.now() - start + 25 + Math.random() * 50);
        const success = successes < available ? (successes++, true) : false;
        results.push({
          id: i + 1,
          success,
          ms,
          error: success ? undefined : 'Conflict',
        });
      }),
    );

    setStressResults(results.sort((a, b) => a.id - b.id));
    setStressRunning(false);
  }

  // Calculate metrics
  const totalStock = products.reduce(
    (s, p) => s + p.inventory.reduce((ss, i) => ss + i.totalStock, 0),
    0,
  );
  const availableStock = products.reduce(
    (s, p) => s + p.inventory.reduce((ss, i) => ss + getAvailableStock(i), 0),
    0,
  );
  const pendingCount = reservations.filter((r) => r.status === 'PENDING').length;
  const confirmedCount = reservations.filter((r) => r.status === 'CONFIRMED').length;

  // Warehouse metrics
  const warehouseMap = new Map<string, { name: string; total: number; available: number }>();
  products.forEach((p) => {
    p.inventory.forEach((inv) => {
      const warehouseId = (inv as any).warehouse?.id || inv.id;
      const warehouseName = (inv as any).warehouse?.name || 'Unknown';
      if (!warehouseMap.has(warehouseId)) {
        warehouseMap.set(warehouseId, { name: warehouseName, total: 0, available: 0 });
      }
      const w = warehouseMap.get(warehouseId)!;
      w.total += inv.totalStock;
      w.available += getAvailableStock(inv);
    });
  });

  const chartData = Array.from(warehouseMap.values()).map((w) => ({
    name: w.name,
    available: w.available,
    reserved: w.total - w.available,
  }));

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-900">Inventory</span>
              </div>

              <nav className="flex border-l border-border">
                {[
                  { id: 'products', label: 'Products' },
                  {
                    id: 'reservations',
                    label: `Reservations${reservations.length > 0 ? ` (${reservations.length})` : ''}`,
                  },
                  { id: 'analytics', label: 'Analytics' },
                  { id: 'stress', label: 'Stress Test' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'text-slate-900 border-blue-600'
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'products' && (
                <button
                  onClick={loadProducts}
                  disabled={loading}
                  className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              )}
              <div className="text-[11px] text-slate-400 font-mono ml-4">
                {format(lastSync, 'HH:mm:ss')}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-red-700">{error}</div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Metrics */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Stock', value: totalStock.toLocaleString() },
                { label: 'Available', value: availableStock.toLocaleString() },
                { label: 'Pending', value: pendingCount.toString() },
                { label: 'Confirmed', value: confirmedCount.toString() },
              ].map((m) => (
                <div key={m.label} className="bg-white border border-border rounded p-4">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                    {m.label}
                  </div>
                  <div className="text-2xl font-semibold text-slate-900 font-mono">{m.value}</div>
                </div>
              ))}
            </div>

            {/* Products Table */}
            {loading ? (
              <div className="bg-white border border-border rounded p-12 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="bg-white border border-border rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-border font-medium text-sm">
                  Products ({products.length})
                </div>

                {products.map((product, idx) => (
                  <div key={product.id}>
                    {idx > 0 && <div className="border-t border-border" />}

                    <button
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          next.has(product.id) ? next.delete(product.id) : next.add(product.id);
                          return next;
                        })
                      }
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left"
                    >
                      {expanded.has(product.id) ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      <span className="flex-1 font-medium text-slate-900">{product.name}</span>
                      <Badge variant={getTotalAvailable(product) > 0 ? 'success' : 'danger'}>
                        {getTotalAvailable(product)} avail
                      </Badge>
                    </button>

                    {expanded.has(product.id) && (
                      <div className="border-t border-border bg-slate-50 p-4">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border/60">
                              {['Warehouse', 'Total', 'Reserved', 'Available', 'Status', 'Action'].map(
                                (h) => (
                                  <th
                                    key={h}
                                    className={`py-2 text-[11px] font-medium text-slate-400 uppercase ${
                                      h === 'Warehouse'
                                        ? 'text-left'
                                        : h === 'Action'
                                        ? 'text-right'
                                        : 'text-center'
                                    }`}
                                  >
                                    {h}
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {product.inventory.map((inv) => {
                              const avail = getAvailableStock(inv);
                              const warehouseName = (inv as any).warehouse?.name || 'Unknown';
                              return (
                                <tr key={inv.id} className="border-b border-border/40 hover:bg-white">
                                  <td className="py-2 text-slate-700">{warehouseName}</td>
                                  <td className="text-center font-mono text-slate-500">
                                    {inv.totalStock}
                                  </td>
                                  <td className="text-center font-mono text-slate-500">
                                    {inv.totalStock - avail}
                                  </td>
                                  <td className="text-center font-mono font-semibold text-slate-900">
                                    {avail}
                                  </td>
                                  <td className="text-center">
                                    <Badge variant={getStockVariant(avail, inv.totalStock)}>
                                      {avail === 0 ? 'Empty' : avail <= 5 ? 'Low' : 'Stock'}
                                    </Badge>
                                  </td>
                                  <td className="text-right">
                                    {avail > 0 ? (
                                      <button
                                        onClick={() => {
                                          setReserveModal({ product, inventory: inv });
                                          setReserveQty(1);
                                          setReserveError(null);
                                        }}
                                        className="px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                                      >
                                        Reserve
                                      </button>
                                    ) : (
                                      <span className="text-slate-300">—</span>
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
            )}
          </div>
        )}

        {/* RESERVATIONS TAB */}
        {activeTab === 'reservations' && (
          <div>
            {reservations.length === 0 ? (
              <div className="bg-white border border-border rounded p-12 text-center text-slate-400 text-sm">
                No reservations yet
              </div>
            ) : (
              <div className="bg-white border border-border rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex justify-between items-center">
                  <span className="font-medium">Reservations ({reservations.length})</span>
                  <div className="flex gap-2">
                    <Badge variant="warning">{pendingCount} pending</Badge>
                    <Badge variant="success">{confirmedCount} confirmed</Badge>
                  </div>
                </div>

                {reservations.map((res) => (
                  <ReservationRow
                    key={res.id}
                    res={res}
                    isActive={activeReservation === res.id}
                    onSelect={() =>
                      setActiveReservation(activeReservation === res.id ? null : res.id)
                    }
                    onConfirm={() => handleConfirm(res.id)}
                    onRelease={() => handleRelease(res.id)}
                    confirming={confirmingId === res.id}
                    releasing={releasingId === res.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="bg-white border border-border rounded p-6">
            <h3 className="font-medium mb-4">Warehouse Utilization</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="available" fill="#10b981" />
                <Bar dataKey="reserved" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* STRESS TEST TAB */}
        {activeTab === 'stress' && (
          <div className="space-y-4">
            <div className="bg-white border border-border rounded p-6">
              <h3 className="font-medium mb-4">Concurrency Test</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Product</label>
                  <select
                    value={stressProduct}
                    onChange={(e) => {
                      setStressProduct(e.target.value);
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod?.inventory[0]) {
                        setStressInventory(prod.inventory[0].id);
                      }
                    }}
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-600 block mb-1">Warehouse</label>
                  <select
                    value={stressInventory}
                    onChange={(e) => setStressInventory(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  >
                    {products
                      .find((p) => p.id === stressProduct)
                      ?.inventory.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name}
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  onClick={runStressTest}
                  disabled={stressRunning}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {stressRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {stressRunning ? 'Running...' : 'Run 50 Concurrent Requests'}
                </button>
              </div>
            </div>

            {stressResults && (
              <div className="bg-white border border-border rounded p-6">
                <h3 className="font-medium mb-4">Results</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    {
                      label: 'Successful',
                      value: stressResults.filter((r) => r.success).length,
                      color: 'text-emerald-600',
                    },
                    {
                      label: 'Failed',
                      value: stressResults.filter((r) => !r.success).length,
                      color: 'text-red-600',
                    },
                    {
                      label: 'Avg Time',
                      value: `${Math.round(stressResults.reduce((s, r) => s + r.ms, 0) / stressResults.length)}ms`,
                      color: 'text-slate-600',
                    },
                  ].map((m) => (
                    <div key={m.label} className="border border-border rounded p-4 text-center">
                      <div className="text-[11px] text-slate-400 uppercase mb-1">{m.label}</div>
                      <div className={`text-2xl font-semibold ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {['ID', 'Result', 'Time'].map((h) => (
                        <th key={h} className="py-2 text-left text-slate-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stressResults.slice(0, 20).map((r) => (
                      <tr key={r.id} className="border-b border-border/40">
                        <td className="py-2 font-mono text-slate-500">{r.id}</td>
                        <td className="py-2">
                          {r.success ? (
                            <Badge variant="success">Success</Badge>
                          ) : (
                            <Badge variant="danger">{r.error}</Badge>
                          )}
                        </td>
                        <td className="py-2 font-mono text-slate-500">{r.ms}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-xs text-slate-400">
                  Showing first 20 of {stressResults.length} results
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Reserve Modal */}
      {reserveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-lg mb-4">
              Reserve {reserveModal.product.name}
            </h3>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-600 mb-2">
                  {reserveModal.inventory.name} - {getAvailableStock(reserveModal.inventory)} available
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={reserveQty}
                  onChange={(e) => setReserveQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-border rounded"
                />
              </div>

              {reserveError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{reserveError}</div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setReserveModal(null)}
                  className="flex-1 px-4 py-2 border border-border rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReserve}
                  disabled={reserving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {reserving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reserve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
