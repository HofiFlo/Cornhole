'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

export default function SettingsForm({ tournamentStart, durationMin }: { tournamentStart: string; durationMin: number }) {
  const router = useRouter();
  const [start, setStart] = useState(tournamentStart);
  const [duration, setDuration] = useState(String(durationMin));
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/admin/settings', 'POST', { tournamentStart: start, durationMin: Number(duration) });
      setMsg('Gespeichert');
      router.refresh();
    } catch (err) { setMsg((err as Error).message); }
  }

  return (
    <form onSubmit={save} className="row">
      <label>Turnierbeginn <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label>Minuten pro Spiel-Slot <input type="number" min={5} max={120} style={{ width: '5rem' }} value={duration} onChange={e => setDuration(e.target.value)} /></label>
      <button type="submit" className="secondary">Speichern</button>
      {msg && <span className="muted">{msg}</span>}
    </form>
  );
}
