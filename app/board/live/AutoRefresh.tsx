'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Lädt die Server-Daten des Live-Boards regelmäßig neu (ohne sichtbares Neuladen der Seite). */
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
