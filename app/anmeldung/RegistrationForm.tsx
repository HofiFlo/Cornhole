'use client';

import { useEffect, useState } from 'react';

type Sent = { verificationSent: true; email: string; teamName: string };

const SUFFIX = /\s+(X{0,1}(?:IX|IV|V?I{0,3}))$/;

export default function RegistrationForm({ clubs }: { clubs: string[] }) {
  const [form, setForm] = useState({
    teamName: '', clubName: '', player1Name: '', player1Email: '', player1Phone: '',
    player2Name: '', player2Email: '', player2Phone: '',
  });
  const [suffixHint, setSuffixHint] = useState<string | null>(null);
  const [result, setResult] = useState<Sent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    const club = form.clubName.trim();
    if (club.length < 3) { setSuffixHint(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/club-teams?club=${encodeURIComponent(club)}`);
        const { suffix } = await res.json();
        setSuffixHint(suffix ?? null);
      } catch { setSuffixHint(null); }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.clubName]);

  function applySuffix() {
    const base = form.teamName.replace(SUFFIX, '').trim() || form.clubName.trim();
    setForm(f => ({ ...f, teamName: `${base} ${suffixHint}` }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Anmeldung fehlgeschlagen'); return; }
      setResult(data);
      window.scrollTo({ top: 0 });
    } catch {
      setError('Keine Verbindung – bitte erneut versuchen.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="card stack">
        <h2>Fast geschafft – bitte E-Mail bestätigen</h2>
        <p>Wir haben einen Bestätigungslink an <strong>{result.email}</strong> geschickt. Die Anmeldung von
          „{result.teamName}“ ist erst gültig, wenn du den Link öffnest und bestätigst. Danach bekommst du die Zahlungsdaten.</p>
        <p className="muted">Keine Mail bekommen? Bitte auch im Spam-Ordner nachsehen. Der Link ist 48 Stunden gültig.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="registration-form">
      <label>Teamname
        <input required minLength={2} maxLength={60} value={form.teamName} onChange={set('teamName')} />
      </label>
      <label>Verein (falls zutreffend)
        <input list="clubs" maxLength={80} value={form.clubName} onChange={set('clubName')} />
        <datalist id="clubs">{clubs.map(c => <option key={c} value={c} />)}</datalist>
      </label>
      {suffixHint && !form.teamName.trim().endsWith(` ${suffixHint}`) && (
        <p className="suffix-hint">
          Für diesen Verein sind bereits Teams angemeldet. Vorschlag: Zusatz „{suffixHint}“.
          <button type="button" className="small secondary" onClick={applySuffix}>„{suffixHint}“ anhängen</button>
        </p>
      )}
      <fieldset>
        <legend>Spieler 1</legend>
        <input required placeholder="Name" autoComplete="name" value={form.player1Name} onChange={set('player1Name')} />
        <input required type="email" placeholder="E-Mail (an diese Adresse geht der Bestätigungslink)" autoComplete="email" value={form.player1Email} onChange={set('player1Email')} />
        <input type="tel" placeholder="Telefon" autoComplete="tel" value={form.player1Phone} onChange={set('player1Phone')} />
      </fieldset>
      <fieldset>
        <legend>Spieler 2</legend>
        <input required placeholder="Name" value={form.player2Name} onChange={set('player2Name')} />
        <input type="email" placeholder="E-Mail (optional)" value={form.player2Email} onChange={set('player2Email')} />
        <input type="tel" placeholder="Telefon (optional)" value={form.player2Phone} onChange={set('player2Phone')} />
      </fieldset>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Wird gesendet…' : 'Verbindlich anmelden'}</button>
    </form>
  );
}
