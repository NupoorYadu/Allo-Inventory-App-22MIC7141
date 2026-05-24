'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Package2, Search } from "lucide-react";

import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/shared/badge";
import { MetricCard, Panel, ProductThumbnail, ProgressRail, SectionTitle } from "@/components/platform-ui";
import { getProducts, ProductData } from "@/lib/api";
import { flattenInventory, summarizeDashboard } from "@/lib/platform";

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [query, setQuery] = useState("");
  const [warehouse, setWarehouse] = useState("all");

  useEffect(() => {
    void getProducts().then(setProducts);
  }, []);

  const flat = useMemo(() => flattenInventory(products), [products]);
  const warehouses = useMemo(() => Array.from(new Set(flat.map((item) => item.inventory.warehouse.name))), [flat]);
  const filtered = flat.filter(({ product, inventory }) => {
    const matchesQuery = `${product.name} ${inventory.warehouse.name}`.toLowerCase().includes(query.toLowerCase());
    const matchesWarehouse = warehouse === "all" || inventory.warehouse.name === warehouse;
    return matchesQuery && matchesWarehouse;
  });
  const summary = useMemo(() => summarizeDashboard(products, []), [products]);

  return (
    <PlatformShell
      eyebrow="Inventory"
      title="Inventory lanes"
      description="A detailed operational view of every product and warehouse lane, optimized for quick stock triage."
      actions={
        <>
          <div className="relative flex-1 min-w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product or warehouse" className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
          </div>
          <select value={warehouse} onChange={(event) => setWarehouse(event.target.value)} className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
            <option value="all">All warehouses</option>
            {warehouses.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <Badge variant="muted">{filtered.length} lanes shown</Badge>
        </>
      }
    >
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Stock lanes" value={flat.length} detail="Product/warehouse combinations" accent="blue" />
        <MetricCard label="Healthy lanes" value={flat.filter(({ inventory }) => inventory.availableStock > 5).length} detail="Enough stock for normal flow" accent="emerald" />
        <MetricCard label="Watch lanes" value={flat.filter(({ inventory }) => inventory.availableStock > 0 && inventory.availableStock <= 5).length} detail="Low but not empty" accent="amber" />
        <MetricCard label="Blocked lanes" value={flat.filter(({ inventory }) => inventory.availableStock === 0).length} detail="No inventory left" accent="rose" />
      </section>

      <Panel>
        <SectionTitle eyebrow="Lane table" title="Warehouse stock matrix" description="The table below keeps the operational detail compact but still exposes the data needed to act fast." />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200/80 text-left">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-5 py-4">Product</th>
                <th className="px-5 py-4">Warehouse</th>
                <th className="px-5 py-4">Health</th>
                <th className="px-5 py-4 text-right">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 bg-white">
              {filtered.map(({ product, inventory }) => (
                <tr key={inventory.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <ProductThumbnail name={product.name} sku={`SKU-${product.id.slice(-4).toUpperCase()}`} />
                      <div>
                        <div className="font-medium text-slate-950">{product.name}</div>
                        <div className="font-mono text-xs text-slate-400">{product.id.slice(0, 10)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{inventory.warehouse.name}</td>
                  <td className="px-5 py-4">
                    <div className="max-w-[220px] space-y-2">
                      <Badge variant={inventory.availableStock === 0 ? "danger" : inventory.availableStock <= 5 ? "warning" : "success"}>{inventory.availableStock === 0 ? "critical" : inventory.availableStock <= 5 ? "watch" : "healthy"}</Badge>
                      <ProgressRail value={inventory.availableStock} max={Math.max(1, inventory.totalStock)} tone={inventory.availableStock === 0 ? "rose" : inventory.availableStock <= 5 ? "amber" : "emerald"} />
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm text-slate-950">{inventory.availableStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <SectionTitle eyebrow="Quick navigation" title="Operations shortcuts" />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {products.slice(0, 3).map((product) => (
            <Link key={product.id} href="/dashboard" className="group rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 transition hover:border-teal-200 hover:bg-white">
              <div className="flex items-center gap-3">
                <Package2 className="h-5 w-5 text-teal-700" />
                <div>
                  <div className="font-medium text-slate-950">{product.name}</div>
                  <div className="text-sm text-slate-500">Inspect on the dashboard</div>
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-700">
                Open lane view <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </PlatformShell>
  );
}
