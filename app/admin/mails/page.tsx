import { config } from '@/lib/config';
import { findAllTeams } from '@/lib/registration';
import { isStandalone } from '@/lib/sync';
import MailComposer from './MailComposer';

export default async function MailsPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const preselect = Number((await searchParams).team) || null;
  const teams = findAllTeams()
    .filter(t => t.registration_status !== 'unverified')
    .map(({ email_verify_token: _, ...t }) => t);
  return (
    <div className="stack">
      <h1>E-Mails an Teams</h1>
      <p className="muted">
        Mails gehen an Spieler 1 und – falls angegeben – Spieler 2.{' '}
        {isStandalone()
          ? 'Standalone-Betrieb: Versand direkt von dieser App.'
          : 'Versand über die gehostete Anmelde-Instanz (Internetverbindung nötig).'}
      </p>
      <MailComposer teams={teams} preselect={preselect} iban={config.iban} entryFee={config.entryFee} />
    </div>
  );
}
