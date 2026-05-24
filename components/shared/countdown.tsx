'use client';

import { useEffect, useState } from 'react';
import { differenceInSeconds } from 'date-fns';

export function useCountdown(expiresAt: Date | null): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const tick = () => setSeconds(Math.max(0, differenceInSeconds(expiresAt, new Date())));
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return seconds;
}

interface CountdownDisplayProps {
  expiresAt: Date | null;
  isExpired?: boolean;
}

export function CountdownDisplay({ expiresAt, isExpired }: CountdownDisplayProps) {
  const secs = useCountdown(expiresAt);
  const mins = Math.floor(secs / 60);
  const sec = secs % 60;

  if (isExpired || secs === 0) {
    return <span className="text-xs font-mono text-slate-400">expired</span>;
  }

  return (
    <span
      className={`text-xs font-mono tabular-nums flex-shrink-0 ${
        secs < 60 ? 'text-red-500' : 'text-amber-600'
      }`}
    >
      {mins}:{String(sec).padStart(2, '0')}
    </span>
  );
}
