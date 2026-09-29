import { config } from '@/lib/config';
import { db, getSetting } from '@/lib/db';
import { isRegistrationOpen } from '@/lib/registration';
import { isStandalone } from '@/lib/sync';
import { getPhase, getScheduleSettings } from '@/lib/tournament';
import { formatDateTime } from '@/lib/util';
import { ActionButton } from './components/ActionButton';
import { PHASE_LABELS } from './labels';
import SettingsForm from './SettingsForm';

export default function AdminDashboard() {
  const counts = Object.fromEntries(
    (db().prepare('SELECT registration_status AS s, COUNT(*) AS n FROM teams GROUP BY registration_status').all() as { s: string; n: number }[])
      .map(r => [r.s, r.n])
  );
  const matches = db().prepare(
    `SELECT COUNT(*) AS total, SUM(status = 'finished') AS done FROM group_matches WHERE is_bye = 0`
  ).get() as { total: number; done: number | null };
  const open = isRegistrationOpen();
  const phase = getPhase();
  const lastSync = getSetting('last_sync_at');
  const { tournamentStartRaw, durationMin } = getScheduleSettings();

  return (
    <div className="stack">
      <h1>Übersicht</h1>
      <div className="stats">
        <div className="stat"><div className="value">{counts.confirmed ?? 0} / {config.maxTeams}</div><div className="label">Bestätigte Teams</div></div>
        <div className="stat"><div className="value">{counts.pending ?? 0}</div><div className="label">Zahlung offen</div></div>
        <div className="stat"><div className="value">{counts.waitlist ?? 0}</div><div className="label">Warteliste</div></div>
        <div className="stat"><div className="value">{matches.done ?? 0} / {matches.total}</div><div className="label">Gruppenspiele erfasst</div></div>
      </div>

      <section className="card stack">
        <h3>Phase: {PHASE_LABELS[phase]}</h3>
        <p className="muted">
          {isStandalone()
            ? 'Standalone-Betrieb (kein HOSTED_URL gesetzt): Anmeldungen werden direkt in dieser Datenbank verwaltet.'
            : <>Gehostete Anmeldung: <code>{config.hostedUrl}</code></>}
          {' '}Letzter Sync: {lastSync ? formatDateTime(lastSync) : 'noch nie'}.
        </p>
        <div className="row">
          <ActionButton url="/api/admin/sync" className="secondary">Anmeldungen synchronisieren</ActionButton>
          {(phase === 'registration' || phase === 'setup') && (open ? (
            <ActionButton url="/api/admin/registration" body={{ open: false }} className="danger"
              confirmText="Anmeldung schließen? Danach sind keine neuen Anmeldungen mehr möglich.">
              Anmeldung schließen
            </ActionButton>
          ) : (
            <ActionButton url="/api/admin/registration" body={{ open: true }} className="secondary">Anmeldung wieder öffnen</ActionButton>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h3>Zeitplan</h3>
        <SettingsForm tournamentStart={tournamentStartRaw} durationMin={durationMin} />
      </section>

      <section className="card">
        <h3>Ablauf am Turniertag</h3>
        <ol>
          <li>Anmeldungen synchronisieren, Zahlungen bestätigen, Anmeldung schließen.</li>
          <li>Gruppen zuteilen (Vereine werden verteilt) und Spielplan generieren.</li>
          <li>Turnierzettel der Gruppenspiele unter „Spielplan &amp; Ergebnisse“ erfassen.</li>
          <li>Nach dem letzten Gruppenspiel die KO-Runde erzeugen, Ergebnisse unter „KO-Runde“ erfassen.</li>
          <li>Live-Board auf dem Hochformat-Display öffnen.</li>
        </ol>
      </section>
    </div>
  );
}
