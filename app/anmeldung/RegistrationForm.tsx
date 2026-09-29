'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/util';

type Result =
  | { waitlisted: true; teamName: string }
  | { paymentReference: string; iban: string; accountHolder: string; entryFee: string; dueDate: string; teamName: string };

const SUFFIX = /\s+(I|II|III|IV|V|VI|VII|VIII)$/;

export default function RegistrationForm({ clubs }: { clubs: string[] }) {
  const [form, setForm] = useState({
    teamName: '', clubName: '', player1Name: '', player1Email: '', player1Phone: '',
    player2Name: '', player2Email: '', player2Phone: '',
  });
  const [suffixHint, setSuffixHint] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
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

  if (result && 'waitlisted' in result) return <WaitlistConfirmation teamName={result.teamName} />;
  if (result) return <PaymentInstructions {...result} />;

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
        <input required type="email" placeholder="E-Mail" autoComplete="email" value={form.player1Email} onChange={set('player1Email')} />
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

function WaitlistConfirmation({ teamName }: { teamName: string }) {
  return (
    <div className="card stack">
      <h2>„{teamName}“ steht auf der Warteliste</h2>
      <p>Das Turnier ist leider bereits voll. Sobald ein Platz frei wird, bekommt ihr eine E-Mail mit den Zahlungsinformationen.
        Bitte bis dahin <strong>noch nichts überweisen</strong>.</p>
    </div>
  );
}

function PaymentInstructions(r: Exclude<Result, { waitlisted: true }>) {
  return (
    <div className="card stack">
      <h2>Danke für die Anmeldung von „{r.teamName}“!</h2>
      <p>Die Anmeldung ist erst nach Zahlungseingang bestätigt. Bitte überweist die Teilnahmegebühr bis <strong>{formatDate(r.dueDate)}</strong>:</p>
      <dl className="payment-box">
        {r.accountHolder && <><dt>Empfänger</dt><dd>{r.accountHolder}</dd></>}
        <dt>IBAN</dt><dd className="reference">{r.iban}</dd>
        {r.entryFee && <><dt>Betrag</dt><dd>{r.entryFee}</dd></>}
        <dt>Verwendungszweck</dt><dd className="reference">{r.paymentReference}</dd>
      </dl>
      <p className="notice">Bitte unbedingt den Verwendungszweck <strong className="reference">{r.paymentReference}</strong> angeben – nur so können wir die Zahlung zuordnen.
        Die Daten wurden zusätzlich per E-Mail verschickt.</p>
    </div>
  );
}
