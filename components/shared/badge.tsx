import React from 'react';
import { BadgeVariant } from '@/lib/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = 'muted' }: BadgeProps) {
  const classes: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    muted: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-mono border rounded-sm leading-none ${classes[variant]}`}
    >
      {children}
    </span>
  );
}
