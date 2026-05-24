import React from 'react';
import { BadgeVariant } from '@/lib/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'muted', className = '' }: BadgeProps) {
  const classes: Record<BadgeVariant, string> = {
    success: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50/80 text-amber-700',
    danger: 'border-rose-200 bg-rose-50/80 text-rose-700',
    muted: 'border-slate-200 bg-slate-100/80 text-slate-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] leading-none ${classes[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
