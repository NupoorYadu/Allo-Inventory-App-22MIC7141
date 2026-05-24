'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Command,
  LayoutDashboard,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Warehouse,
  FlaskConical,
} from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/shared/badge";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reservations", label: "Reservations", icon: Warehouse },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/simulator", label: "Simulator", icon: FlaskConical },
  { href: "/system-health", label: "System Health", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];

export function PlatformShell({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1760px] flex-col gap-4 px-3 py-3 md:px-4 lg:flex-row lg:px-6 lg:py-5">
        <aside className="lg:w-[288px]">
          <div className="allo-surface sticky top-4 overflow-hidden rounded-[28px] border border-slate-200/80 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200/80 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight">Allo</div>
                  <div className="text-xs text-slate-500">Inventory operations console</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  <span>Live status</span>
                  <Badge variant="success" className="border-0 bg-emerald-100/80 text-emerald-700">online</Badge>
                </div>
                <div className="text-sm font-medium text-slate-900">Realtime sync active</div>
                <div className="mt-1 text-xs text-slate-500">Polls inventory and reservations every 5s.</div>
              </div>
            </div>

            <nav className="space-y-1 p-3">
              {navigation.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200 ${
                      active
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-700"}`} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-200/80 p-4">
              <div className="rounded-3xl bg-slate-950 p-4 text-white shadow-[0_20px_40px_rgba(15,23,42,0.28)]">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">Operational posture</div>
                <div className="text-sm font-semibold">Concurrency-safe reservations</div>
                <div className="mt-2 text-xs leading-5 text-slate-300">
                  PostgreSQL transactions, advisory idempotency locks, and live cleanup keep the inventory view coherent under load.
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="allo-surface sticky top-3 z-20 rounded-[28px] border border-slate-200/80 px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl md:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                {eyebrow && <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">{eyebrow}</div>}
                <div className="mt-1 flex items-center gap-3">
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
                  <Badge variant="success" className="hidden border-0 bg-emerald-100/70 text-emerald-700 md:inline-flex">live</Badge>
                </div>
                {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 text-balance">{description}</p>}
              </div>

              <div className="flex flex-col gap-3 lg:w-[540px] lg:flex-row lg:items-center lg:justify-end">
                <label className="relative flex-1">
                  <Command className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    readOnly
                    value="Search products, reservations, warehouses..."
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white/95 pl-10 pr-4 text-sm text-slate-500 shadow-sm outline-none transition focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="border-slate-200 bg-slate-100/80 text-slate-600">Vercel + Supabase</Badge>
                  <Badge variant="warning" className="border-amber-200 bg-amber-50/80 text-amber-700">Cron every minute</Badge>
                </div>
              </div>
            </div>

            {actions && <div className="mt-4 flex flex-wrap items-center gap-3">{actions}</div>}
          </header>

          <motion.main
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="min-w-0 flex-1 space-y-4 pb-6"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  );
}