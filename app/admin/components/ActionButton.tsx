'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

/** Button, der einen API-Call ausführt und danach die Seite neu lädt. */
export function ActionButton({
  url, method = 'POST', body, confirmText, children, className, redirectTo, disabled, successText,
}: {
  url: string; method?: 'POST' | 'PATCH' | 'DELETE'; body?: unknown; confirmText?: string;
  children: React.ReactNode; className?: string; redirectTo?: string; disabled?: boolean; successText?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run() {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true); setError(null); setDone(false);
    try {
      await api(url, method, body);
      if (successText) { setDone(true); setTimeout(() => setDone(false), 4000); }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={run} disabled={busy || disabled}>
        {busy ? '…' : children}
      </button>
      {error && <span className="error" style={{ marginLeft: 8 }}>{error}</span>}
      {done && <span className="success" style={{ marginLeft: 8, padding: '0.1rem 0.5rem' }}>{successText}</span>}
    </>
  );
}
