'use client';

import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Play, Terminal } from "lucide-react";

import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/shared/badge";
import { MetricCard, Panel, SectionTitle } from "@/components/platform-ui";
import { getProducts, ProductData } from "@/lib/api";

type LogLine = { level: "info" | "ok" | "warn" | "error"; text: string; ms?: number };
type StressResult = { id: number; status: number; ms: number; reservationId?: string };

export default function SimulatorPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [inventoryId, setInventoryId] = useState("");
  const [count, setCount] = useState(50);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<StressResult[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);

  useEffect(() => {
    void getProducts().then((nextProducts) => {
      setProducts(nextProducts);
      if (!inventoryId) setInventoryId(nextProducts.flatMap((product) => product.inventory)[0]?.id ?? "");
    });
  }, [inventoryId]);

  const target = useMemo(
    () => products.flatMap((product) => product.inventory.map((inventory) => ({ product, inventory }))).find((item) => item.inventory.id === inventoryId),
    [inventoryId, products]
  );

  const summary = useMemo(() => ({
    success: results.filter((result) => result.status === 201).length,
    conflict: results.filter((result) => result.status === 409).length,
    other: results.filter((result) => result.status !== 201 && result.status !== 409).length,
    avgMs: results.length ? Math.round(results.reduce((sum, result) => sum + result.ms, 0) / results.length) : 0,
  }), [results]);

  async function runStressTest() {
    if (!target) return;
    setRunning(true);
    setResults([]);
    setLogs([{ level: "info", text: `Dispatching ${count} concurrent reservation requests against ${target.inventory.warehouse.name}` }]);

    const started = performance.now();
    const nextResults = await Promise.all(Array.from({ length: count }, async (_, index) => {
      const requestStarted = performance.now();
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ inventoryId: target.inventory.id, quantity: 1 }),
      });
      const body = await response.json().catch(() => ({}));
      return {
        id: index + 1,
        status: response.status,
        ms: Math.round(performance.now() - requestStarted),
        reservationId: typeof body.id === "string" ? body.id : undefined,
      };
    }));

    setResults(nextResults);
    setLogs([
      { level: "ok", text: `Completed in ${Math.round(performance.now() - started)}ms` },
      ...nextResults.slice(0, 12).map((result) => ({
        level: (result.status === 201 ? "ok" : result.status === 409 ? "warn" : "error") as LogLine["level"],
        text: `#${result.id} -> ${result.status}${result.reservationId ? ` (${result.reservationId.slice(0, 10)}...)` : ""}`,
        ms: result.ms,
      })),
    ]);
    setRunning(false);
  }

  const latencySeries = results.slice(0, 20).map((result) => ({ name: `r${result.id}`, ms: result.ms }));

  return (
    <PlatformShell
      eyebrow="Simulator"
      title="Concurrency lab"
      description="A live test harness for proving that the reservation path remains race-condition free under burst traffic."
      actions={
        <>
          <Badge variant="muted">{target ? target.inventory.warehouse.name : "no inventory selected"}</Badge>
          <button onClick={runStressTest} disabled={running || !target} className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 disabled:opacity-50">
            <Play className="h-4 w-4" /> Run test
          </button>
        </>
      }
    >
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Selected inventory" value={target ? target.inventory.availableStock : 0} detail="Available units before load" accent="blue" />
        <MetricCard label="Successes" value={summary.success} detail="Reservation rows created" accent="emerald" />
        <MetricCard label="Conflicts" value={summary.conflict} detail="Correct 409 responses" accent="amber" />
        <MetricCard label="Average latency" value={`${summary.avgMs} ms`} detail="Per reservation request" accent="violet" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Panel>
          <SectionTitle eyebrow="Load controls" title="Burst reservation test" description="Choose 10, 50, or 100 concurrent requests and watch the reservation system defend the last units." />
          <div className="grid gap-4 p-5 md:grid-cols-[1fr_0.7fr]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[10, 50, 100].map((option) => (
                  <button key={option} onClick={() => setCount(option)} className={`rounded-2xl border px-4 py-4 text-left transition ${count === option ? "border-teal-300 bg-teal-50/80" : "border-slate-200 bg-slate-50/80 hover:bg-white"}`}>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Concurrent</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{option}</div>
                  </button>
                ))}
              </div>
              <label className="space-y-2 text-sm text-slate-600">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Inventory target</span>
                <select value={inventoryId} onChange={(event) => setInventoryId(event.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                  {products.flatMap((product) => product.inventory.map((inventory) => <option key={inventory.id} value={inventory.id}>{product.name} · {inventory.warehouse.name}</option>))}
                </select>
              </label>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-950 p-4 text-white shadow-[0_20px_40px_rgba(15,23,42,0.28)]">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400"><Terminal className="h-4 w-4" /> Request log</div>
              <div className="max-h-72 space-y-2 overflow-auto font-mono text-xs leading-6 text-slate-300">
                {logs.length === 0 ? <div className="text-slate-500">Awaiting test run...</div> : logs.map((line, index) => <div key={`${line.text}-${index}`} className={`flex items-center gap-2 ${line.level === "ok" ? "text-emerald-300" : line.level === "warn" ? "text-amber-300" : line.level === "error" ? "text-rose-300" : "text-slate-300"}`}><span className="opacity-60">[{line.level}]</span><span>{line.text}</span>{line.ms ? <span className="ml-auto opacity-60">{line.ms}ms</span> : null}</div>)}
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle eyebrow="Validation" title="Oversell prevention" description="The point of the simulator is not raw speed. It is proving that only the stock that exists can be reserved." />
          <div className="grid gap-3 p-5">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><span className="text-sm text-slate-600">Reservation success</span><Badge variant="success">{summary.success}</Badge></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><span className="text-sm text-slate-600">Conflict responses</span><Badge variant="warning">{summary.conflict}</Badge></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"><span className="text-sm text-slate-600">Unexpected responses</span><Badge variant="danger">{summary.other}</Badge></div>
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionTitle eyebrow="Latency" title="Request duration by request" />
        <div className="h-[280px] p-4 sm:p-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencySeries} margin={{ top: 20, right: 18, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="#64748b" />
              <YAxis tickLine={false} axisLine={false} stroke="#64748b" />
              <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid rgb(226 232 240)" }} />
              <Line type="monotone" dataKey="ms" stroke="#0f766e" strokeWidth={3} dot={{ r: 2.5, fill: "#0f766e" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </PlatformShell>
  );
}
