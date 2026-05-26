import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'muted';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = 'muted' }: BadgeProps) {
  const classes: Record<BadgeVariant, string> = {
    success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-100',
    warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200 dark:border-amber-400/20 dark:bg-amber-400/12 dark:text-amber-100',
    danger: 'border-rose-400/30 bg-rose-400/10 text-rose-200 dark:border-rose-400/20 dark:bg-rose-400/12 dark:text-rose-100',
    muted: 'border-slate-500/30 bg-slate-500/10 text-slate-300 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide leading-none ${classes[variant]}`}
    >
      {children}
    </span>
  );
}
