'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

/** Button, der einen API-Call ausführt und danach die Seite neu lädt. */
export function ActionButton({
  url, method = 'POST', body, confirmText, children, className, redirectTo, disabled,
}: {
  url: string; method?: 'POST' | 'PATCH' | 'DELETE'; body?: unknown; confirmText?: string;
  children: React.ReactNode; className?: string; redirectTo?: string; disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true); setError(null);
    try {
      await api(url, method, body);
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
    </>
  );
}
