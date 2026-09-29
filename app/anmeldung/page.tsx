import { config } from '@/lib/config';
import { db } from '@/lib/db';
import { isRegistrationOpen, listClubs } from '@/lib/registration';
import RegistrationForm from './RegistrationForm';

export const dynamic = 'force-dynamic';

export default function AnmeldungPage() {
  const open = isRegistrationOpen();
  const { n: active } = db().prepare(
    `SELECT COUNT(*) AS n FROM teams WHERE registration_status IN ('pending','confirmed')`
  ).get() as { n: number };
  const freeSpots = Math.max(0, config.maxTeams - active);

  return (
    <main className="public-page stack">
      <h1>{config.tournamentName} – Anmeldung</h1>
      {!open ? (
        <p className="notice">Die Anmeldung ist geschlossen.</p>
      ) : (
        <>
          <p className="muted">
            2er-Teams, max. {config.maxTeams} Mannschaften{config.entryFee && <>, Teilnahmegebühr {config.entryFee} pro Team</>}.
            Die Anmeldung ist erst nach Eingang der Überweisung bestätigt.{' '}
            {freeSpots > 0
              ? <>Aktuell noch <strong>{freeSpots}</strong> Plätze frei.</>
              : <strong>Das Turnier ist voll – neue Anmeldungen kommen auf die Warteliste.</strong>}
          </p>
          <RegistrationForm clubs={listClubs()} />
        </>
      )}
    </main>
  );
}
