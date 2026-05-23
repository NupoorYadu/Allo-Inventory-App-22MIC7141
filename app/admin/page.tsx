"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";

interface Stats {
  totalStock: number;
  reservedStock: number;
  confirmedReservations: number;
  releasedReservations: number;
  pendingReservations: number;
  warehouseUtilization: Array<{
    name: string;
    totalStock: number;
    reservedStock: number;
    utilizationPercent: number;
  }>;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch products for inventory data
        const productsRes = await fetch("/api/products");
        const products = await productsRes.json();

        // Fetch reservations for status data
        const reservationsRes = await fetch("/api/reservations");
        const reservations = await reservationsRes.json();

        // Calculate stats
        let totalStock = 0;
        let reservedStock = 0;
        const warehouseMap = new Map<
          string,
          { name: string; totalStock: number; reservedStock: number }
        >();

        products.forEach((product: any) => {
          product.inventory.forEach((inv: any) => {
            totalStock += inv.totalStock;
            reservedStock += inv.reservedStock;

            if (!warehouseMap.has(inv.warehouse.id)) {
              warehouseMap.set(inv.warehouse.id, {
                name: inv.warehouse.name,
                totalStock: 0,
                reservedStock: 0,
              });
            }

            const warehouse = warehouseMap.get(inv.warehouse.id)!;
            warehouse.totalStock += inv.totalStock;
            warehouse.reservedStock += inv.reservedStock;
          });
        });

        const confirmedReservations = reservations.filter(
          (r: any) => r.status === "CONFIRMED"
        ).length;

        const releasedReservations = reservations.filter(
          (r: any) => r.status === "RELEASED"
        ).length;

        const pendingReservations = reservations.filter(
          (r: any) => r.status === "PENDING"
        ).length;

        const warehouseUtilization = Array.from(warehouseMap.values()).map(
          (warehouse) => ({
            ...warehouse,
            utilizationPercent:
              warehouse.totalStock > 0
                ? Math.round(
                    ((warehouse.totalStock - warehouse.reservedStock) /
                      warehouse.totalStock) *
                      100
                  )
                : 0,
          })
        );

        setStats({
          totalStock,
          reservedStock,
          confirmedReservations,
          releasedReservations,
          pendingReservations,
          warehouseUtilization,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch stats");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to products
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {loading && <p className="text-center">Loading stats...</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
            {error}
          </div>
        )}

        {stats && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm mb-2">Total Stock</p>
                <p className="text-4xl font-bold">{stats.totalStock}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm mb-2">Reserved Stock</p>
                <p className="text-4xl font-bold text-orange-600">
                  {stats.reservedStock}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm mb-2">Available Stock</p>
                <p className="text-4xl font-bold text-green-600">
                  {stats.totalStock - stats.reservedStock}
                </p>
              </div>
            </div>

            {/* Reservation Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
                <p className="text-gray-600 text-sm mb-2">Pending Reservations</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {stats.pendingReservations}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                <p className="text-gray-600 text-sm mb-2">Confirmed</p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.confirmedReservations}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
                <p className="text-gray-600 text-sm mb-2">Released</p>
                <p className="text-3xl font-bold text-gray-600">
                  {stats.releasedReservations}
                </p>
              </div>
            </div>

            {/* Warehouse Utilization */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">Warehouse Utilization</h2>
              <div className="space-y-6">
                {stats.warehouseUtilization.map((warehouse) => (
                  <div key={warehouse.name}>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{warehouse.name}</span>
                      <span className="text-sm text-gray-600">
                        {warehouse.utilizationPercent}% available
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${warehouse.utilizationPercent}%`,
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {warehouse.totalStock - warehouse.reservedStock} /{" "}
                      {warehouse.totalStock} units
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
