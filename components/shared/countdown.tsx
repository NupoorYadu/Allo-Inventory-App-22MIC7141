'use client';

import { useEffect, useState } from 'react';
import { differenceInSeconds } from 'date-fns';

export function useCountdown(expiresAt: Date | string | null): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const target = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    const tick = () => setSeconds(Math.max(0, differenceInSeconds(target, new Date())));
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return seconds;
}
