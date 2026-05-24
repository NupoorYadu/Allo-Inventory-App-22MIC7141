'use client';

import { motion } from "framer-motion";

import { Badge } from "@/components/shared/badge";

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`allo-surface overflow-hidden rounded-[28px] border border-slate-200/80 shadow-[0_18px_42px_rgba(15,23,42,0.06)] ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/70 p-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">{eyebrow}</div>}
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  accent = "slate",
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  accent?: "slate" | "emerald" | "amber" | "blue" | "violet" | "rose";
}) {
  const accentClasses: Record<typeof accent, string> = {
    slate: "from-slate-50 to-white text-slate-950",
    emerald: "from-emerald-50 to-white text-emerald-950",
    amber: "from-amber-50 to-white text-amber-950",
    blue: "from-blue-50 to-white text-blue-950",
    violet: "from-violet-50 to-white text-violet-950",
    rose: "from-rose-50 to-white text-rose-950",
  };

  return (
    <div className={`rounded-[24px] border border-slate-200/80 bg-gradient-to-br p-5 shadow-sm ${accentClasses[accent]}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      {detail && <div className="mt-2 text-sm text-slate-500">{detail}</div>}
    </div>
  );
}

export function AnimatedNumber({ value, className = "" }: { value: number; className?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={className}
    >
      {value.toLocaleString()}
    </motion.span>
  );
}

export function ProductThumbnail({ name, sku }: { name: string; sku: string }) {
  const hue = hashString(name) % 360;
  const hueTwo = (hue + 46) % 360;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div
      className="relative flex h-14 w-14 shrink-0 items-end overflow-hidden rounded-2xl border border-white/60 shadow-sm"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 85% 55%), hsl(${hueTwo} 75% 38%))` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.38),transparent_40%)]" />
      <div className="relative flex h-full w-full flex-col justify-between p-2 text-white">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] opacity-80">{sku}</div>
        <div className="text-xl font-semibold leading-none tracking-tight">{initials}</div>
      </div>
    </div>
  );
}

export function ProgressRail({ value, max, tone = "emerald" }: { value: number; max: number; tone?: "emerald" | "amber" | "rose" | "blue" }) {
  const width = max === 0 ? 0 : Math.max(4, Math.min(100, Math.round((value / max) * 100)));
  const fills: Record<typeof tone, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    blue: "bg-blue-500",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-500 ${fills[tone]}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function LiveDot({ label = "live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-teal-700">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-40" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
      </span>
      {label}
    </span>
  );
}

export { Badge };