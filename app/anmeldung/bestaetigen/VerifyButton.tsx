'use client';

import { useState } from 'react';
import type { RegistrationResult } from '@/lib/registration';
import RegistrationResultView from '../RegistrationResult';

export default function VerifyButton({ token }: { token: string }) {
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Bestätigung fehlgeschlagen');
      else setResult(data);
    } catch {
      setError('Keine Verbindung – bitte erneut versuchen.');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <RegistrationResultView result={result} />;
  return (
    <>
      <button onClick={verify} disabled={busy}>{busy ? 'Wird bestätigt…' : 'Anmeldung jetzt bestätigen'}</button>
      {error && <p className="error">{error}</p>}
    </>
  );
}
